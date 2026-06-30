"""Роутер для управления панелями."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin
from app.database import get_async_db
from app.models import Panel, Dashboard, User
from app.schemas import PanelCreate, PanelUpdate, PanelResponse
import json

router = APIRouter(prefix="/api", tags=["panels"])


@router.post("/dashboards/{dashboard_id}/panels", response_model=PanelResponse, status_code=201)
async def create_panel(
    dashboard_id: int,
    data: PanelCreate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Создание новой панели."""
    dashboard = await db.get(Dashboard, dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    panel = Panel(
        dashboard_id=dashboard_id,
        panel_type=data.panel_type,
        title=data.title,
        position=data.position,
        size=data.size,
        config=json.dumps(data.config)
    )
    db.add(panel)
    await db.flush()
    await db.refresh(panel)
    
    return PanelResponse(
        id=panel.id,
        dashboard_id=panel.dashboard_id,
        panel_type=panel.panel_type,
        title=panel.title,
        position=panel.position,
        size=panel.size,
        config=data.config,
        created_at=panel.created_at
    )


@router.put("/panels/{panel_id}", response_model=PanelResponse)
async def update_panel(
    panel_id: int,
    data: PanelUpdate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Обновление панели."""
    panel = await db.get(Panel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    update_data = data.model_dump(exclude_unset=True)
    if "config" in update_data and update_data["config"] is not None:
        update_data["config"] = json.dumps(update_data["config"])
    
    for k, v in update_data.items():
        setattr(panel, k, v)
    
    db.add(panel)
    await db.flush()
    await db.refresh(panel)
    
    config = json.loads(panel.config) if isinstance(panel.config, str) else panel.config
    
    return PanelResponse(
        id=panel.id,
        dashboard_id=panel.dashboard_id,
        panel_type=panel.panel_type,
        title=panel.title,
        position=panel.position,
        size=panel.size,
        config=config,
        created_at=panel.created_at
    )


@router.delete("/panels/{panel_id}")
async def delete_panel(
    panel_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Удаление панели."""
    panel = await db.get(Panel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    await db.delete(panel)
    return {"ok": True}