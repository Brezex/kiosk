"""Роутер для управления профилем пользователя."""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_async_db
from app.models import User
from app.schemas import ProfileUpdate, UserResponse

router = APIRouter(prefix="/api/profile", tags=["profile"])

# Директория для аватарок
AVATAR_DIR = "static/avatars"
os.makedirs(AVATAR_DIR, exist_ok=True)


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Получить свой профиль."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Обновить свой профиль (имя)."""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    
    if data.avatar is not None:
        current_user.avatar = data.avatar
    
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Загрузить аватарку."""
    # Проверка типа файла
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")
    
    # Генерируем уникальное имя файла
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)
    
    # Сохраняем файл
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Удаляем старую аватарку, если есть
    if current_user.avatar:
        old_path = os.path.join(AVATAR_DIR, current_user.avatar)
        if os.path.exists(old_path):
            os.remove(old_path)
    
    # Обновляем профиль
    current_user.avatar = filename
    db.add(current_user)
    await db.flush()
    
    return {"avatar": filename, "url": f"/static/avatars/{filename}"}