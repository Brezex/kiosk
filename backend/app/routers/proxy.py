"""Прокси для Zabbix API с кешированием."""
import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_async_db
from app.models import ZabbixServer, User
from app.schemas import ZabbixHostsRequest, ZabbixItemsRequest, ZabbixHistoryRequest, ZabbixProblemsRequest
from app.zabbix_client import get_client_for_server, cache_key
from app.cache import zabbix_cache
from app.background import problems_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/proxy/zabbix", tags=["proxy"])

# Глобальный кэш item_id -> value_type
item_value_types: dict[str, int] = {}


async def _get_server(db: AsyncSession, server_id: int) -> ZabbixServer:
    result = await db.execute(select(ZabbixServer).where(ZabbixServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Zabbix server not found")
    return server


@router.post("/hosts")
async def get_hosts(data: ZabbixHostsRequest, db: AsyncSession = Depends(get_async_db), _: User = Depends(get_current_user)):
    server = await _get_server(db, data.server_id)
    key = cache_key(data.server_id, "hosts", search=data.search or "")
    cached = zabbix_cache.get(key)
    if cached is not None:
        return cached
    client = await get_client_for_server(server.api_url, server.api_token_encrypted)
    result = await client.get_hosts(search=data.search)
    zabbix_cache.set(key, result, ttl=300)
    return result


@router.post("/items")
async def get_items(data: ZabbixItemsRequest, db: AsyncSession = Depends(get_async_db), _: User = Depends(get_current_user)):
    server = await _get_server(db, data.server_id)
    key = cache_key(data.server_id, "items", host_id=data.host_id, search=data.search or "")
    cached = zabbix_cache.get(key)
    if cached is not None:
        return cached
    client = await get_client_for_server(server.api_url, server.api_token_encrypted)
    result = await client.get_items(data.host_id, search=data.search)
    # Сохраняем маппинг item_id -> value_type
    for item in result:
        item_value_types[item["itemid"]] = int(item["value_type"])
    zabbix_cache.set(key, result, ttl=60)
    return result


@router.post("/history")
async def get_history(data: ZabbixHistoryRequest, db: AsyncSession = Depends(get_async_db), _: User = Depends(get_current_user)):
    server = await _get_server(db, data.server_id)
    client = await get_client_for_server(server.api_url, server.api_token_encrypted)

    # Группируем item_ids по value_type
    items_by_type: defaultdict[int, list[str]] = defaultdict(list)
    missing_ids: list[str] = []

    for item_id in data.item_ids:
        vt = item_value_types.get(item_id)
        if vt is not None:
            items_by_type[vt].append(item_id)
        else:
            missing_ids.append(item_id)

    # Если есть неизвестные типы — запрашиваем их одним batch-запросом
    if missing_ids:
        logger.info(f"Fetching missing value_types for {len(missing_ids)} items")
        try:
            batch_result = await client._call("item.get", {
                "itemids": missing_ids,
                "output": ["itemid", "value_type"],
                "limit": len(missing_ids),
            })
            for item in batch_result:
                vt = int(item["value_type"])
                item_value_types[item["itemid"]] = vt
                items_by_type[vt].append(item["itemid"])
        except Exception as e:
            logger.warning(f"Failed to resolve missing value_types: {e}")

    if not items_by_type:
        return []

    all_results = []
    for value_type, ids in items_by_type.items():
        key = cache_key(
            data.server_id,
            "history",
            item_ids=",".join(sorted(ids)),
            value_type=value_type,
            period=data.period,
            limit=data.limit,
        )
        cached = zabbix_cache.get(key)
        if cached is not None:
            all_results.extend(cached)
            continue
        result = await client.get_history(ids, value_type, data.period, data.limit)
        zabbix_cache.set(key, result, ttl=60)
        all_results.extend(result)
    return all_results


@router.post("/problems")
async def get_problems(data: ZabbixProblemsRequest, db: AsyncSession = Depends(get_async_db), _: User = Depends(get_current_user)):
    return problems_store.get(data.server_id, [])