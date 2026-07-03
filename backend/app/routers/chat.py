"""API для чатов."""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import User, ChatMessage
from app.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ============ Pydantic схемы ============

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    message: str
    created_at: str
    is_read: bool

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    receiver_id: int = Field(..., description="ID получателя")
    message: str = Field(..., min_length=1, max_length=4000, description="Текст сообщения")


class UnreadCountOut(BaseModel):
    count: int


# ============ Эндпоинты ============

@router.get("/users", response_model=List[UserOut])
def get_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получить список всех пользователей (кроме текущего)."""
    users = db.query(User).filter(User.id != current_user.id).all()
    return [
        UserOut(
            id=u.id,
            username=u.username,
            full_name=u.full_name or u.username,  # ← ИЗМЕНЕНО: используем full_name
        )
        for u in users
    ]


@router.get("/messages/{user_id}", response_model=List[MessageOut])
def get_messages(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получить сообщения с конкретным пользователем."""
    other_user = db.query(User).filter(User.id == user_id).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    messages = (
        db.query(ChatMessage)
        .filter(
            (
                (ChatMessage.sender_id == current_user.id)
                & (ChatMessage.receiver_id == user_id)
            )
            | (
                (ChatMessage.sender_id == user_id)
                & (ChatMessage.receiver_id == current_user.id)
            )
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    # Помечаем входящие сообщения как прочитанные
    unread_messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.sender_id == user_id,
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False,
        )
        .all()
    )
    for msg in unread_messages:
        msg.is_read = True
    db.commit()

    return [
        MessageOut(
            id=m.id,
            sender_id=m.sender_id,
            receiver_id=m.receiver_id,
            message=m.message,
            created_at=m.created_at.isoformat(),
            is_read=m.is_read,
        )
        for m in messages
    ]


@router.post("/messages", response_model=MessageOut, status_code=201)
def send_message(
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Отправить сообщение."""
    message_text = data.message.strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")

    receiver = db.query(User).filter(User.id == data.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Получатель не найден")

    if receiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя отправить сообщение самому себе")

    chat_message = ChatMessage(
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        message=message_text,
    )
    db.add(chat_message)
    db.commit()
    db.refresh(chat_message)

    return MessageOut(
        id=chat_message.id,
        sender_id=chat_message.sender_id,
        receiver_id=chat_message.receiver_id,
        message=chat_message.message,
        created_at=chat_message.created_at.isoformat(),
        is_read=chat_message.is_read,
    )

@router.get("/unread-by-users")
def get_unread_by_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получить количество непрочитанных сообщений по каждому отправителю."""
    from sqlalchemy import func
    
    results = (
        db.query(
            ChatMessage.sender_id,
            func.count(ChatMessage.id).label("count")
        )
        .filter(
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False,
        )
        .group_by(ChatMessage.sender_id)
        .all()
    )
    
    return {str(sender_id): count for sender_id, count in results}

@router.get("/unread", response_model=UnreadCountOut)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получить количество непрочитанных сообщений."""
    count = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False,
        )
        .count()
    )
    return UnreadCountOut(count=count)


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Удалить своё сообщение."""
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Можно удалять только свои сообщения")

    db.delete(msg)
    db.commit()
    return {"detail": "Сообщение удалено"}