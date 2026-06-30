"""Фоновые задачи: опрос Zabbix на наличие проблем."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import ScheduledNotification

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import ZabbixServer
from app.notifications import notification_store
from app.zabbix_client import ZabbixClient, decrypt_token

logger = logging.getLogger(__name__)

# Флаг, есть ли соединение с Zabbix
_zabbix_connected: Dict[int, bool] = {}

async def check_notifications():
    """Проверяет и отправляет уведомления в нужное время"""
    while True:
        try:
            db: Session = SessionLocal()
            now = datetime.utcnow()
            
            # Находим уведомления, которые нужно отправить (в течение последней минуты)
            notifications = db.query(ScheduledNotification).filter(
                ScheduledNotification.scheduled_at <= now,
                ScheduledNotification.scheduled_at >= now - timedelta(minutes=1),
                ScheduledNotification.is_active == True,
                ScheduledNotification.is_sent == False
            ).all()
            
            for notification in notifications:
                logger.info(f"📢 Sending notification: {notification.title}")
                # Здесь можно добавить логику отправки (WebSocket, polling flag и т.д.)
                notification.is_sent = True
                db.commit()
            
            db.close()
        except Exception as e:
            logger.error(f"Error checking notifications: {e}")
        
        await asyncio.sleep(60)  # Проверка каждую минуту

def start_notification_checker():
    """Запускает фоновую проверку уведомлений"""
    asyncio.create_task(check_notifications())

def start_notification_checker():
    """Запускает фоновую проверку уведомлений"""
    asyncio.create_task(check_notifications())


def start_background_poller():
    """Запускает фоновый опрос Zabbix-серверов"""
    asyncio.create_task(background_poller())

def is_zabbix_connected() -> bool:
    """Проверка, есть ли хотя бы одно активное соединение."""
    return any(_zabbix_connected.values()) if _zabbix_connected else True


async def poll_problems_for_server(server: ZabbixServer) -> None:
    """Опрос проблем для одного Zabbix-сервера."""
    try:
        token = decrypt_token(server.api_token_encrypted)
        client = ZabbixClient(server.api_url, token)
        
        # Получаем активные проблемы
        problems = await client.get_problems(recent=True, limit=200)
        
        # Получаем имена хостов
        host_ids = list({p["hostid"] for p in problems if "hostid" in p})
        host_names = await client.get_host_names(host_ids)
        
        # Множество актуальных event_id
        active_event_ids = set()
        
        severity_map = {
            "0": "not_classified",
            "1": "information",
            "2": "warning",
            "3": "average",
            "4": "high",
            "5": "disaster",
        }
        
        for p in problems:
            event_id = str(p["eventid"])
            active_event_ids.add(event_id)
            
            # resolved=1 значит проблема уже решена
            status = "resolved" if str(p.get("resolved")) == "1" else "active"
            
            # Время события
            clock = int(p.get("clock", 0))
            time_str = datetime.fromtimestamp(clock).strftime("%H:%M:%S") if clock else "?"
            
            host_name = host_names.get(p.get("hostid"), f"Host {p.get('hostid', '?')}")
            
            notification_store.upsert(
                event_id=event_id,
                host_name=host_name,
                problem_name=p.get("name", "Unknown problem"),
                severity=severity_map.get(str(p.get("severity", "0")), "not_classified"),
                time=time_str,
                status=status,
                description=p.get("description") or p.get("name"),
            )
        
        # Помечаем как resolved те, которых больше нет в активных
        for n in notification_store.get_all():
            if n.event_id and n.event_id not in active_event_ids and n.status == "active":
                notification_store.upsert(
                    event_id=n.event_id,
                    status="resolved",
                )
        
        _zabbix_connected[server.id] = True
        logger.debug(f"Polled {len(problems)} problems from {server.name}")
        
    except Exception as e:
        logger.error(f"Error polling {server.name}: {e}")
        _zabbix_connected[server.id] = False


async def poll_all_servers() -> None:
    """Опрос всех активных Zabbix-серверов."""
    async with async_session() as session:
        result = await session.execute(
            select(ZabbixServer).where(ZabbixServer.is_active == True)
        )
        servers = result.scalars().all()
    
    # Параллельный опрос
    await asyncio.gather(
        *[poll_problems_for_server(s) for s in servers],
        return_exceptions=True,
    )


async def background_poller() -> None:
    """Фоновая задача: опрос каждые 30 секунд."""
    # Ждём 5 секунд при старте (чтобы БД инициализировалась)
    await asyncio.sleep(5)
    logger.info("Background poller started")
    
    while True:
        try:
            await poll_all_servers()
        except Exception as e:
            logger.error(f"Background poller error: {e}")
        await asyncio.sleep(30)