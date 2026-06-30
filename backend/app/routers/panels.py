"""Роутер панелей."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_async_db
from app.models import Panel, Dashboard, User
from app.schemas import PanelCreate, PanelUpdate, PanelResponse

router = APIRouter(tags=["panels"])


@router.get("/api/dashboards/{dashboard_id}/panels", response_model=List[PanelResponse])
async def list_panels(
    dashboard_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Список панелей дашборда."""
    result = await db.execute(
        select(Panel).where(Panel.dashboard_id == dashboard_id).order_by(Panel.position)
    )
    return result.scalars().all()


@router.post("/api/dashboards/{dashboard_id}/panels", response_model=PanelResponse, status_code=201)
async def create_panel(
    dashboard_id: int,
    data: PanelCreate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Создание панели."""
    # Проверка существования дашборда
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    panel = Panel(dashboard_id=dashboard_id, **data.model_dump())
    db.add(panel)
    await db.flush()
    await db.refresh(panel)
    return panel


@router.put("/api/panels/{panel_id}", response_model=PanelResponse)
async def update_panel(
    panel_id: int,
    data: PanelUpdate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Обновление панели."""
    result = await db.execute(select(Panel).where(Panel.id == panel_id))
    panel = result.scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(panel, k, v)
    
    db.add(panel)
    await db.flush()
    await db.refresh(panel)
    return panel


@router.delete("/api/panels/{panel_id}")
async def delete_panel(
    panel_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Удаление панели."""
    result = await db.execute(select(Panel).where(Panel.id == panel_id))
    panel = result.scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    await db.delete(panel)
    return {"ok": True}