"""Простой in-memory кеш с TTL."""
import time
from typing import Any, Optional, Dict, Tuple
from threading import Lock


class InMemoryCache:
    """In-memory кеш с TTL."""
    
    def __init__(self):
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._lock = Lock()
    
    def get(self, key: str) -> Optional[Any]:
        """Получение значения из кеша."""
        with self._lock:
            if key not in self._cache:
                return None
            expire_at, value = self._cache[key]
            if time.time() > expire_at:
                del self._cache[key]
                return None
            return value
    
    def set(self, key: str, value: Any, ttl: int = 60) -> None:
        """Сохранение значения в кеш."""
        with self._lock:
            self._cache[key] = (time.time() + ttl, value)
    
    def delete(self, key: str) -> None:
        """Удаление значения из кеша."""
        with self._lock:
            self._cache.pop(key, None)
    
    def clear(self) -> None:
        """Очистка всего кеша."""
        with self._lock:
            self._cache.clear()


# Глобальный кеш для данных Zabbix
zabbix_cache = InMemoryCache()