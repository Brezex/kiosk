"""Хранилище уведомлений в памяти (не в БД)."""
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from threading import Lock
from dataclasses import dataclass, field, asdict


@dataclass
class Notification:
    """Уведомление о проблеме."""
    id: str
    host_name: str
    problem_name: str
    severity: str
    time: str
    status: str  # "active" | "resolved"
    description: Optional[str] = None
    event_id: Optional[str] = None
    resolved_at: Optional[str] = None
    # Время, когда уведомление было помечено как решённое (для автоудаления)
    _resolved_timestamp: Optional[float] = field(default=None, repr=False)


class NotificationStore:
    """In-memory хранилище уведомлений."""
    
    def __init__(self):
        # event_id -> Notification
        self._notifications: Dict[str, Notification] = {}
        self._lock = Lock()
        # Сколько секунд держать "решённое" уведомление перед удалением
        self.resolved_ttl = 10
    
    def upsert(self, event_id: str, **kwargs) -> Notification:
        """Создать или обновить уведомление."""
        with self._lock:
            if event_id in self._notifications:
                n = self._notifications[event_id]
                for k, v in kwargs.items():
                    if hasattr(n, k):
                        setattr(n, k, v)
                # Если статус изменился на resolved — фиксируем время
                if kwargs.get("status") == "resolved" and n.resolved_at is None:
                    n.resolved_at = datetime.now().strftime("%H:%M:%S")
                    n._resolved_timestamp = datetime.now().timestamp()
                return n
            else:
                n = Notification(id=str(uuid.uuid4()), event_id=event_id, **kwargs)
                self._notifications[event_id] = n
                return n
    
    def get_all(self) -> List[Notification]:
        """Получить все уведомления (активные + недавно решённые)."""
        import time
        now = time.time()
        with self._lock:
            # Удаляем старые resolved
            to_delete = [
                eid for eid, n in self._notifications.items()
                if n.status == "resolved" 
                and n._resolved_timestamp is not None
                and (now - n._resolved_timestamp) > self.resolved_ttl
            ]
            for eid in to_delete:
                del self._notifications[eid]
            
            # Сортируем: сначала активные, потом по времени (новые сверху)
            items = list(self._notifications.values())
            items.sort(
                key=lambda n: (
                    0 if n.status == "active" else 1,
                    n.time,
                ),
                reverse=True,
            )
            return items
    
    def clear(self) -> None:
        """Очистить все уведомления."""
        with self._lock:
            self._notifications.clear()
    
    def to_dict(self, n: Notification) -> dict:
        """Преобразование в словарь для API."""
        return {
            "id": n.id,
            "event_id": n.event_id,
            "host_name": n.host_name,
            "problem_name": n.problem_name,
            "severity": n.severity,
            "time": n.time,
            "status": n.status,
            "description": n.description,
            "resolved_at": n.resolved_at,
        }


# Глобальный стор
notification_store = NotificationStore()