"""Прокси для Zabbix API с кешированием."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_async_db
from app.models import ZabbixServer, User
from app.schemas import (
    ZabbixHostsRequest, ZabbixItemsRequest, ZabbixHistoryRequest,
    ZabbixProblemsRequest,
)
from app.zabbix_client import get_client_for_server, cache_key
from app.cache import zabbix_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/proxy/zabbix", tags=["proxy"])


async def _get_server(db: AsyncSession, server_id: int) -> ZabbixServer:
    """Получение сервера из БД."""
    result = await db.execute(
        select(ZabbixServer).where(ZabbixServer.id == server_id)
    )
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Zabbix server not found")
    return server


@router.post("/hosts")
async def get_hosts(
    data: ZabbixHostsRequest,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Получение списка хостов."""
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
async def get_items(
    data: ZabbixItemsRequest,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Получение items для хоста."""
    server = await _get_server(db, data.server_id)
    
    key = cache_key(data.server_id, "items", host_id=data.host_id, search=data.search or "")
    cached = zabbix_cache.get(key)
    if cached is not None:
        return cached
    
    client = await get_client_for_server(server.api_url, server.api_token_encrypted)
    result = await client.get_items(data.host_id, search=data.search)
    zabbix_cache.set(key, result, ttl=300)
    return result


@router.post("/history")
async def get_history(
    data: ZabbixHistoryRequest,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Получение истории значений."""
    server = await _get_server(db, data.server_id)
    
    key = cache_key(
        data.server_id, "history",
        item_ids=",".join(data.item_ids),
        period=data.period,
        limit=data.limit,
    )
    cached = zabbix_cache.get(key)
    if cached is not None:
        return cached
    
    client = await get_client_for_server(server.api_url, server.api_token_encrypted)
    result = await client.get_history(data.item_ids, data.period, data.limit)
    # Кеш на 60 секунд
    zabbix_cache.set(key, result, ttl=60)
    return result


@router.post("/problems")
async def get_problems(
    data: ZabbixProblemsRequest,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Получение активных проблем."""
    server = await _get_server(db, data.server_id)
    client = await get_client_for_server(server.api_url, server.api_token_encrypted)
    return await client.get_problems(recent=data.recent, limit=data.limit)