"""Роутер Zabbix-серверов."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin
from app.database import get_async_db
from app.models import ZabbixServer, User
from app.schemas import (
    ZabbixServerCreate, ZabbixServerUpdate, ZabbixServerResponse,
    ZabbixServerTestResult,
)
from app.zabbix_client import encrypt_token, ZabbixClient

router = APIRouter(prefix="/api/zabbix_servers", tags=["zabbix_servers"])


@router.get("", response_model=List[ZabbixServerResponse])
async def list_servers(
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(get_current_user),
):
    """Список Zabbix-серверов."""
    result = await db.execute(select(ZabbixServer).order_by(ZabbixServer.name))
    return result.scalars().all()


@router.post("", response_model=ZabbixServerResponse, status_code=201)
async def create_server(
    data: ZabbixServerCreate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Создание Zabbix-сервера."""
    server = ZabbixServer(
        name=data.name,
        api_url=data.api_url,
        api_token_encrypted=encrypt_token(data.api_token),
        is_active=data.is_active,
    )
    db.add(server)
    await db.flush()
    await db.refresh(server)
    return server


@router.put("/{server_id}", response_model=ZabbixServerResponse)
async def update_server(
    server_id: int,
    data: ZabbixServerUpdate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Обновление Zabbix-сервера."""
    result = await db.execute(select(ZabbixServer).where(ZabbixServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    update_data = data.model_dump(exclude_unset=True)
    if "api_token" in update_data:
        token = update_data.pop("api_token")
        server.api_token_encrypted = encrypt_token(token)
    
    for k, v in update_data.items():
        setattr(server, k, v)
    
    db.add(server)
    await db.flush()
    await db.refresh(server)
    return server


@router.delete("/{server_id}")
async def delete_server(
    server_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Удаление Zabbix-сервера."""
    result = await db.execute(select(ZabbixServer).where(ZabbixServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    await db.delete(server)
    return {"ok": True}


@router.post("/{server_id}/test", response_model=ZabbixServerTestResult)
async def test_server(
    server_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(require_admin),
):
    """Тест соединения с Zabbix-сервером."""
    result = await db.execute(select(ZabbixServer).where(ZabbixServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    try:
        from app.zabbix_client import decrypt_token
        token = decrypt_token(server.api_token_encrypted)
        client = ZabbixClient(server.api_url, token)
        version = await client.api_version()
        return ZabbixServerTestResult(success=True, version=version)
    except Exception as e:
        return ZabbixServerTestResult(success=False, error=str(e))