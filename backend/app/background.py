"""Фоновые задачи: опрос Zabbix на наличие проблем и проверка уведомлений."""
import asyncio
import logging
import traceback
from datetime import datetime, timedelta
from typing import Dict, List

from sqlalchemy import select

from app.database import async_session
from app.models import ZabbixServer, ScheduledNotification
from app.notifications import notification_store
from app.zabbix_client import get_client_for_server

logger = logging.getLogger(__name__)

_zabbix_connected: Dict[int, bool] = {}

# Memory store для проблем — эндпоинт /problems читает отсюда
problems_store: Dict[int, List[Dict]] = {}


async def check_notifications():
    """Проверяет и отправляет уведомления в нужное время."""
    while True:
        try:
            async with async_session() as session:
                now = datetime.utcnow()
                result = await session.execute(
                    select(ScheduledNotification).where(
                        ScheduledNotification.scheduled_at <= now,
                        ScheduledNotification.scheduled_at >= now - timedelta(minutes=1),
                        ScheduledNotification.is_active == True,
                        ScheduledNotification.is_sent == False,
                    )
                )
                for notification in result.scalars().all():
                    logger.info(f"📢 Sending notification: {notification.title}")
                    notification.is_sent = True
        except Exception:
            logger.error(f"Notification check error:\n{traceback.format_exc()}")
        await asyncio.sleep(60)


def start_notification_checker():
    asyncio.create_task(check_notifications())


def start_background_poller():
    asyncio.create_task(background_poller())


def is_zabbix_connected() -> bool:
    return any(_zabbix_connected.values()) if _zabbix_connected else True


async def poll_problems_for_server(server: ZabbixServer) -> None:
    """Опрос проблем для одного Zabbix-сервера."""
    try:
        client = await get_client_for_server(server.api_url, server.api_token_encrypted)

        # Получаем проблемы
        problems = await client.get_problems(recent=True, limit=200)

        # Сохраняем сырые данные в memory store для эндпоинта /problems
        problems_store[server.id] = problems

        active_event_ids = set()
        severity_map = {
            "0": "not_classified",
            "1": "information",
            "2": "warning",
            "3": "average",
            "4": "high",
            "5": "disaster",
        }

        # Собираем уникальные host_ids из проблем
        host_ids = list({p.get("hostid") for p in problems if p.get("hostid")})

        # Получаем имена хостов ОДНИМ запросом (вместо N запросов)
        host_names: Dict[str, str] = {}
        if host_ids:
            try:
                host_names = await client.get_host_names(host_ids)
            except Exception as e:
                logger.warning(f"Failed to fetch host names: {e}")

        for p in problems:
            event_id = str(p["eventid"])
            active_event_ids.add(event_id)
            status = "resolved" if str(p.get("resolved")) == "1" else "active"
            clock = int(p.get("clock", 0))
            time_str = datetime.fromtimestamp(clock).strftime("%H:%M:%S") if clock else "?"

            # Берём имя хоста из кэша host_names
            host_id = p.get("hostid")
            host_name = host_names.get(host_id, "Unknown") if host_id else "Unknown"

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
                notification_store.upsert(event_id=n.event_id, status="resolved")

        _zabbix_connected[server.id] = True
        logger.debug(f"Polled {len(problems)} problems from {server.name}")

    except Exception:
        logger.error(f"Error polling {getattr(server, 'name', 'unknown')}:\n{traceback.format_exc()}")
        _zabbix_connected[server.id] = False


async def poll_all_servers() -> None:
    async with async_session() as session:
        result = await session.execute(select(ZabbixServer).where(ZabbixServer.is_active == True))
        servers = result.scalars().all()
        await asyncio.gather(*[poll_problems_for_server(s) for s in servers], return_exceptions=True)


async def background_poller() -> None:
    await asyncio.sleep(5)
    logger.info("Background poller started")
    while True:
        try:
            await poll_all_servers()
        except Exception:
            logger.error(f"Background poller loop error:\n{traceback.format_exc()}")
        await asyncio.sleep(30)