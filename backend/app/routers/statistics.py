"""Роутер для статистики проблемных узлов."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.auth import get_current_user
from app.database import get_async_db
from app.models import User, ZabbixServer
from app.zabbix_client import ZabbixClient, decrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statistics", tags=["statistics"])


@router.get("/top-problems")
async def get_top_problems(
    top: int = Query(10, ge=1, le=100, description="Количество хостов в топе"),
    period: str = Query("week", description="Период: day, week, month, year"),
    server_id: Optional[int] = Query(None, description="ID Zabbix сервера"),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
):
    """Получить топ проблемных хостов по ICMP ping/loss."""
    
    period_seconds = {
        "day": 86400,
        "week": 604800,
        "month": 2592000,
        "year": 31536000
    }.get(period, 604800)
    
    now = int(datetime.now().timestamp())
    time_from = now - period_seconds
    
    # Получаем Zabbix сервер
    if server_id:
        result = await db.execute(
            select(ZabbixServer).where(ZabbixServer.id == server_id)
        )
        zabbix_server = result.scalar_one_or_none()
        if not zabbix_server:
            raise HTTPException(status_code=404, detail="Zabbix server not found")
    else:
        result = await db.execute(select(ZabbixServer).limit(1))
        zabbix_server = result.scalar_one_or_none()
        if not zabbix_server:
            raise HTTPException(status_code=404, detail="No Zabbix server configured")
    
    try:
        api_token = decrypt_token(zabbix_server.api_token_encrypted)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt token: {str(e)}")
    
    client = ZabbixClient(zabbix_server.api_url, api_token)
    
    try:
        # Сначала проверим версию API (быстрый запрос)
        try:
            version = await client.api_version()
            logger.info(f"Zabbix API версия: {version}")
        except Exception as e:
            logger.error(f"Не удалось подключиться к Zabbix: {e}")
            raise HTTPException(
                status_code=502, 
                detail=f"Не удалось подключиться к Zabbix серверу: {str(e)}"
            )
        
        # Получаем хосты через прямой вызов (без selectInterfaces для скорости)
        hosts = await client._call("host.get", {
            "output": ["hostid", "name"],
            "filter": {"status": 0},
            "sortfield": "name",
        }, timeout=30)
        
        logger.info(f"Получено хостов: {len(hosts)}")
        
        problems = []
        
        for host in hosts:
            host_id = host["hostid"]
            host_name = host["name"]
            
            try:
                # Получаем только нужные items (icmpping*)
                items = await client._call("item.get", {
                    "output": ["itemid", "key_", "name", "value_type"],
                    "hostids": [host_id],
                    "search": {"key_": "icmpping"},
                    "searchWildcardsEnabled": True,
                }, timeout=15)
                
                ping_item = None
                loss_item = None
                
                for item in items:
                    key = item.get("key_", "")
                    if key == "icmpping":
                        ping_item = item
                    elif key == "icmppingloss":
                        loss_item = item
                
                if not ping_item and not loss_item:
                    continue
                
                ping_problems = 0
                loss_problems = 0
                total_checks = 0
                
                if ping_item:
                    try:
                        value_type = int(ping_item.get("value_type", 3))
                        history = await client._call("history.get", {
                            "output": ["value"],
                            "history": value_type,
                            "itemids": [ping_item["itemid"]],
                            "time_from": time_from,
                            "time_till": now,
                            "limit": 10000,
                        }, timeout=30)
                        total_checks = len(history)
                        ping_problems = sum(1 for h in history if h.get("value") == "0")
                    except Exception as e:
                        logger.debug(f"Ping history error for {host_name}: {e}")
                
                if loss_item:
                    try:
                        value_type = int(loss_item.get("value_type", 0))
                        history = await client._call("history.get", {
                            "output": ["value"],
                            "history": value_type,
                            "itemids": [loss_item["itemid"]],
                            "time_from": time_from,
                            "time_till": now,
                            "limit": 10000,
                        }, timeout=30)
                        loss_problems = sum(
                            1 for h in history 
                            if float(h.get("value", 0)) > 0
                        )
                    except Exception as e:
                        logger.debug(f"Loss history error for {host_name}: {e}")
                
                if ping_problems > 0 or loss_problems > 0:
                    problems.append({
                        "host_id": host_id,
                        "host_name": host_name,
                        "ping_problems": ping_problems,
                        "loss_problems": loss_problems,
                        "total_checks": total_checks,
                        "problem_metric": "icmp_loss" if loss_problems > ping_problems else "icmp_ping",
                        "problem_count": max(ping_problems, loss_problems)
                    })
            except Exception:
                continue
        
        problems.sort(key=lambda x: x["problem_count"], reverse=True)
        
        logger.info(f"Найдено хостов с проблемами: {len(problems)}")
        
        return {
            "period": period,
            "period_seconds": period_seconds,
            "total_hosts": len(hosts),
            "hosts_with_problems": len(problems),
            "top": problems[:top]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Критическая ошибка в статистике: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Zabbix API error: {str(e)}")