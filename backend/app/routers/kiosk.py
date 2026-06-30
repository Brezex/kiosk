"""Публичные эндпоинты для режима киоска (без аутентификации)."""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_async_db
from app.models import Dashboard
from app.schemas import KioskDashboard, KioskState, PanelResponse, Notification
from app.config import settings
from app.notifications import notification_store
from app.background import is_zabbix_connected

router = APIRouter(prefix="/api/kiosk", tags=["kiosk"])


@router.get("/dashboards", response_model=List[KioskDashboard])
async def get_kiosk_dashboards(
    db: AsyncSession = Depends(get_async_db),
):
    """Список дашбордов для ротации (только те, что in_rotation)."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels))
        .where(Dashboard.in_rotation == True)
        .order_by(Dashboard.sort_order, Dashboard.id)
    )
    dashboards = result.scalars().all()
    
    return [
        KioskDashboard(
            id=d.id,
            name=d.name,
            rotation_interval=d.rotation_interval or settings.kiosk_rotation_interval,
            panels=[PanelResponse.model_validate(p) for p in d.panels],
            zabbix_server_id=d.zabbix_server_id,
        )
        for d in dashboards
    ]


@router.get("/notifications", response_model=List[Notification])
async def get_notifications():
    """Получение всех уведомлений."""
    return [
        Notification(**notification_store.to_dict(n))
        for n in notification_store.get_all()
    ]


@router.get("/state", response_model=KioskState)
async def get_kiosk_state(
    db: AsyncSession = Depends(get_async_db),
):
    """Полное состояние киоска: дашборды + уведомления + статус связи."""
    dashboards = await get_kiosk_dashboards(db)
    notifications = await get_notifications()
    
    return KioskState(
        dashboards=dashboards,
        notifications=notifications,
        zabbix_connected=is_zabbix_connected(),
        global_rotation_interval=settings.kiosk_rotation_interval,
    )