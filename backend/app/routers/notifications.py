"""Роутер для календарных уведомлений."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin
from app.database import get_async_db
from app.models import ScheduledNotification, User
from app.schemas import (
    ScheduledNotificationCreate,
    ScheduledNotificationUpdate,
    ScheduledNotificationResponse,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=List[ScheduledNotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Список всех календарных уведомлений."""
    result = await db.execute(
        select(ScheduledNotification).order_by(ScheduledNotification.scheduled_at)
    )
    return result.scalars().all()


@router.post("", response_model=ScheduledNotificationResponse, status_code=201)
async def create_notification(
    data: ScheduledNotificationCreate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Создание календарного уведомления."""
    notification = ScheduledNotification(**data.model_dump())
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


@router.put("/{notification_id}", response_model=ScheduledNotificationResponse)
async def update_notification(
    notification_id: int,
    data: ScheduledNotificationUpdate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Обновление календарного уведомления."""
    result = await db.execute(
        select(ScheduledNotification).where(ScheduledNotification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(notification, k, v)
    
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Удаление календарного уведомления."""
    result = await db.execute(
        select(ScheduledNotification).where(ScheduledNotification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notification)
    return {"ok": True}