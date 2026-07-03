"""Асинхронный клиент для Zabbix JSON-RPC API."""
import asyncio
import base64
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx
from cryptography.fernet import Fernet

from app.config import settings

logger = logging.getLogger(__name__)

# Fernet для шифрования токенов (ленивая инициализация)
_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Получение Fernet-шифратора (оригинальный метод)."""
    global _fernet
    if _fernet is None:
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


# Кэш клиентов по api_url для переиспользования HTTP-соединений
_clients_cache: Dict[str, "ZabbixClient"] = {}


async def get_client_for_server(api_url: str, encrypted_token: str) -> "ZabbixClient":
    """Получение клиента для сервера (с кэшированием)."""
    if api_url not in _clients_cache:
        token = decrypt_token(encrypted_token)
        _clients_cache[api_url] = ZabbixClient(api_url, token)
    return _clients_cache[api_url]


def cache_key(server_id: int, method: str, **kwargs) -> str:
    """Формирование ключа кеша."""
    parts = [f"zabbix:{server_id}:{method}"]
    for k in sorted(kwargs.keys()):
        v = kwargs[k]
        if isinstance(v, list):
            v = ",".join(map(str, v))
        parts.append(f"{k}={v}")
    return ":".join(parts)


class ZabbixClient:
    """Асинхронный клиент Zabbix API."""

    def __init__(self, api_url: str, api_token: str):
        self.api_url = api_url.rstrip("/")
        self.api_token = api_token
        self._request_id = 0
        # Один HTTP-клиент на все запросы — Keep-Alive
        self._client = httpx.AsyncClient(timeout=30, verify=False)

    async def close(self):
        """Закрытие HTTP-клиента."""
        await self._client.aclose()

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

        if method != "apiinfo.version":
            headers = {"Authorization": f"Bearer {self.api_token}"}
        else:
            headers = {}

        last_error: Optional[Exception] = None
        for attempt in range(settings.ZABBIX_RETRY_COUNT + 1):
            try:
                response = await self._client.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                    timeout=timeout,
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
        """Получение списка хостов с поиском по полю host."""
        params: Dict[str, Any] = {
            "output": ["hostid", "host", "name", "status"],
            "selectInterfaces": ["ip"],
            "sortfield": "name",
            "limit": 1000,
        }
        if search:
            params["search"] = {"host": search}
            params["searchWildcardsEnabled"] = True
        return await self._call("host.get", params)

    async def get_items(
        self,
        host_id: str,
        search: Optional[str] = None,
    ) -> List[Dict]:
        """Получение items для хоста."""
        params: Dict[str, Any] = {
            "output": ["itemid", "name", "key_", "value_type", "units", "delay", "lastvalue", "lastclock"],
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
        value_type: int,
        period: str = "1h",
        limit: int = 1000,
    ) -> List[Dict]:
        """Получение истории значений.

        value_type должен быть передан явно (берётся из кэша /items).
        """
        if not item_ids:
            return []

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

        # Увеличенный BATCH_SIZE — меньше HTTP-запросов
        BATCH_SIZE = 200
        all_results: List[Dict] = []

        for i in range(0, len(item_ids), BATCH_SIZE):
            batch = item_ids[i:i + BATCH_SIZE]
            try:
                result = await self._call(
                    "history.get",
                    {
                        "output": "extend",
                        "history": value_type,
                        "itemids": batch,
                        "sortfield": "clock",
                        "sortorder": "DESC",
                        "time_from": time_from,
                        "time_till": time_till,
                        "limit": limit,
                    },
                    timeout=30,
                )
                all_results.extend(result)
            except Exception as e:
                logger.warning(f"Failed to fetch history for batch {i // BATCH_SIZE + 1}: {e}")

        return all_results

    async def get_problems(
        self,
        recent: bool = True,
        limit: int = 100,
    ) -> List[Dict]:
        """Получение активных проблем.

        ВАЖНО: selectHosts НЕ используется, т.к. не поддерживается в старых версиях Zabbix API.
        Имена хостов получаются отдельным вызовом get_host_names.
        """
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
        """Получение имён хостов по их ID (один запрос на батч)."""
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