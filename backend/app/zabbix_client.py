"""Асинхронный клиент для Zabbix JSON-RPC API."""
import asyncio
import logging
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet
import httpx

from app.config import settings
from app.cache import zabbix_cache

logger = logging.getLogger(__name__)

# Fernet для шифрования токенов
_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Получение Fernet-шифратора (ленивая инициализация)."""
    global _fernet
    if _fernet is None:
        # secret_key должен быть 32 байта base64 для Fernet
        # Если ключ не подходит — генерируем детерминированный из него
        import base64
        import hashlib
        key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key_bytes)
        _fernet = Fernet(fernet_key)
    return _fernet


def encrypt_token(token: str) -> str:
    """Шифрование токена Zabbix."""
    return _get_fernet().encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    """Дешифрование токена Zabbix."""
    return _get_fernet().decrypt(encrypted.encode()).decode()


class ZabbixClient:
    """Асинхронный клиент Zabbix API."""
    
    def __init__(self, api_url: str, api_token: str):
        self.api_url = api_url.rstrip("/")
        self.api_token = api_token
        self._request_id = 0
    
    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id
    
    async def _call(
        self,
        method: str,
        params: Dict[str, Any],
        timeout: int = 10,
    ) -> Any:
        """Вызов метода Zabbix API с повторами."""
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": self._next_id(),
        }
        
        # apiinfo.version не требует авторизации
        if method != "apiinfo.version":
            # Для Zabbix 6.4+ используем заголовок Authorization
            headers = {"Authorization": f"Bearer {self.api_token}"}
        else:
            headers = {}
        
        last_error: Optional[Exception] = None
        for attempt in range(settings.ZABBIX_RETRY_COUNT + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
                    response = await client.post(
                        self.api_url,
                        json=payload,
                        headers=headers,
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    if "error" in data:
                        err = data["error"]
                        raise RuntimeError(
                            f"Zabbix API error: {err.get('message', '')} - {err.get('data', '')}"
                        )
                    return data.get("result")
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Zabbix API call {method} failed (attempt {attempt+1}): {e}"
                )
                if attempt < settings.ZABBIX_RETRY_COUNT:
                    await asyncio.sleep(1 * (attempt + 1))
        
        raise last_error or RuntimeError("Zabbix API call failed")
    
    async def api_version(self) -> str:
        """Получение версии Zabbix."""
        result = await self._call("apiinfo.version", {})
        return str(result)
    
    async def get_hosts(self, search: Optional[str] = None) -> List[Dict]:
        """Получение списка хостов."""
        params: Dict[str, Any] = {
            "output": ["hostid", "name", "host"],
            "selectInterfaces": ["ip"],
            "sortfield": "name",
            "limit": 500,
        }
        if search:
            params["search"] = {"name": search}
            params["searchWildcardsEnabled"] = True
        return await self._call("host.get", params)
    
    async def get_items(
        self,
        host_id: str,
        search: Optional[str] = None,
    ) -> List[Dict]:
        """Получение items для хоста."""
        params: Dict[str, Any] = {
            "output": ["itemid", "name", "key_", "value_type", "units", "delay"],
            "hostids": [host_id],
            "sortfield": "name",
            "webitems": True,
            "limit": 1000,
        }
        if search:
            params["search"] = {"name": search}
            params["searchWildcardsEnabled"] = True
        return await self._call("item.get", params)
    
    async def get_history(
        self,
        item_ids: List[str],
        period: str = "1h",
        limit: int = 1000,
    ) -> List[Dict]:
        """Получение истории значений."""
        # Сначала получаем value_type первого item'а
        items = await self._call(
            "item.get",
            {
                "itemids": item_ids,
                "output": ["value_type"],
                "limit": 1,
            },
        )
        if not items:
            return []
        value_type = int(items[0]["value_type"])
        
        # Рассчитываем временной диапазон
        from datetime import datetime, timedelta
        period_map = {
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "12h": timedelta(hours=12),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
        }
        delta = period_map.get(period, timedelta(hours=1))
        time_from = int((datetime.now() - delta).timestamp())
        time_till = int(datetime.now().timestamp())
        
        result = await self._call(
            "history.get",
            {
                "output": "extend",
                "history": value_type,
                "itemids": item_ids,
                "sortfield": "clock",
                "sortorder": "ASC",
                "time_from": time_from,
                "time_till": time_till,
                "limit": limit,
            },
        )
        return result
    
    async def get_problems(
        self,
        recent: bool = True,
        limit: int = 100,
    ) -> List[Dict]:
        """Получение активных проблем."""
        params: Dict[str, Any] = {
            "output": "extend",
            "selectAcknowledges": "extend",
            "selectTags": "extend",
            "sortfield": ["eventid"],
            "sortorder": "DESC",
            "recent": recent,
            "limit": limit,
        }
        return await self._call("problem.get", params)
    
    async def get_host_names(self, host_ids: List[str]) -> Dict[str, str]:
        """Получение имён хостов по их ID."""
        if not host_ids:
            return {}
        hosts = await self._call(
            "host.get",
            {
                "output": ["hostid", "name"],
                "hostids": host_ids,
            },
        )
        return {h["hostid"]: h["name"] for h in hosts}


async def get_client_for_server(
    api_url: str,
    encrypted_token: str,
) -> ZabbixClient:
    """Создание клиента для Zabbix-сервера."""
    token = decrypt_token(encrypted_token)
    return ZabbixClient(api_url, token)


def cache_key(server_id: int, method: str, **kwargs) -> str:
    """Формирование ключа кеша."""
    parts = [f"zabbix:{server_id}:{method}"]
    for k in sorted(kwargs.keys()):
        v = kwargs[k]
        if isinstance(v, list):
            v = ",".join(map(str, v))
        parts.append(f"{k}={v}")
    return ":".join(parts)