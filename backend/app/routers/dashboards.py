"""Роутер дашбордов."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_async_db
from app.models import Dashboard, User
from app.schemas import DashboardCreate, DashboardUpdate, DashboardResponse
from app.auth import get_current_user, require_admin
router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


@router.get("", response_model=List[DashboardResponse])
async def list_dashboards(
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Список всех дашбордов."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels), selectinload(Dashboard.zabbix_server))
        .order_by(Dashboard.sort_order, Dashboard.id)
    )
    return result.scalars().all()


@router.post("", response_model=DashboardResponse, status_code=201)
async def create_dashboard(
    data: DashboardCreate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),  # ← Было get_current_user
):
    """Создание дашборда."""
    dashboard = Dashboard(**data.model_dump())
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard, attribute_names=["panels", "zabbix_server"])
    return dashboard


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Получение дашборда."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels), selectinload(Dashboard.zabbix_server))
        .where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: int,
    data: DashboardUpdate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),  # ← Было get_current_user
):
    """Обновление дашборда."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels), selectinload(Dashboard.zabbix_server))
        .where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(dashboard, k, v)
    
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard)
    return dashboard


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),  # ← Было get_current_user
):
    """Удаление дашборда."""
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    await db.delete(dashboard)
    return {"ok": True}


@router.post("/{dashboard_id}/export")
async def export_dashboard(
    dashboard_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Экспорт дашборда в JSON."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.panels))
        .where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {
        "version": 1,
        "dashboard": {
            "name": dashboard.name,
            "description": dashboard.description,
            "rotation_interval": dashboard.rotation_interval,
            "in_rotation": dashboard.in_rotation,
            "sort_order": dashboard.sort_order,
            "panels": [
                {
                    "panel_type": p.panel_type,
                    "title": p.title,
                    "position": p.position,
                    "size": p.size,
                    "config": p.config,
                }
                for p in dashboard.panels
            ],
        },
    }


@router.post("/import")
async def import_dashboard(
    payload: dict,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Импорт дашборда из JSON."""
    if "dashboard" not in payload:
        raise HTTPException(status_code=400, detail="Invalid schema: missing 'dashboard'")
    
    d = payload["dashboard"]
    dashboard = Dashboard(
        name=d.get("name", "Imported"),
        description=d.get("description"),
        rotation_interval=d.get("rotation_interval"),
        in_rotation=d.get("in_rotation", True),
        sort_order=d.get("sort_order", 0),
    )
    db.add(dashboard)
    await db.flush()
    
    from app.models import Panel
    for p in d.get("panels", []):
        panel = Panel(
            dashboard_id=dashboard.id,
            panel_type=p.get("panel_type", "text"),
            title=p.get("title", "Panel"),
            position=p.get("position", 0),
            size=p.get("size", 1),
            config=p.get("config", {}),
        )
        db.add(panel)
    
    await db.flush()
    await db.refresh(dashboard, attribute_names=["panels"])
    return dashboard