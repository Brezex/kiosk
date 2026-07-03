"""API для чатов."""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, ChatMessage
from app.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/users")
def get_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить список всех пользователей (кроме текущего)."""
    users = db.query(User).filter(User.id != current_user.id).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.username,  # Можно заменить на реальное полное имя, если есть
        }
        for u in users
    ]


@router.get("/messages/{user_id}")
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
                (ChatMessage.sender_id == current_user.id) &
                (ChatMessage.receiver_id == user_id)
            ) |
            (
                (ChatMessage.sender_id == user_id) &
                (ChatMessage.receiver_id == current_user.id)
            )
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    
    # Помечаем сообщения как прочитанные
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
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "message": m.message,
            "created_at": m.created_at.isoformat(),
            "is_read": m.is_read,
        }
        for m in messages
    ]


@router.post("/messages")
def send_message(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Отправить сообщение."""
    receiver_id = data.get("receiver_id")
    message = data.get("message", "").strip()
    
    if not receiver_id or not message:
        raise HTTPException(status_code=400, detail="receiver_id и message обязательны")
    
    receiver = db.query(User).filter(User.id == receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Получатель не найден")
    
    chat_message = ChatMessage(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message=message,
    )
    db.add(chat_message)
    db.commit()
    db.refresh(chat_message)
    
    return {
        "id": chat_message.id,
        "sender_id": chat_message.sender_id,
        "receiver_id": chat_message.receiver_id,
        "message": chat_message.message,
        "created_at": chat_message.created_at.isoformat(),
        "is_read": chat_message.is_read,
    }


@router.get("/unread")
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
    return {"count": count}