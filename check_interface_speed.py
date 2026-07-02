"""Проверка метрик Interface Speed."""
import httpx
import json
from datetime import datetime, timedelta

ZABBIX_URL = "http://192.168.215.215/zabbix/api_jsonrpc.php"
ZABBIX_TOKEN = input("Введите токен Zabbix API: ").strip()

def zabbix_request(method: str, params: dict) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "auth": ZABBIX_TOKEN,
        "id": 1,
    }
    response = httpx.post(ZABBIX_URL, json=payload, timeout=10, verify=False)
    return response.json()

# 1. Найти хост "01 Администрация Dionis"
print("=" * 60)
print("1. Поиск хоста '01 Администрация Dionis'")
print("=" * 60)
result = zabbix_request("host.get", {
    "output": ["hostid", "host", "name"],
    "filter": {"host": "01 Администрация Dionis"},
})
if result.get("result"):
    host = result["result"][0]
    host_id = host["hostid"]
    print(f"✅ Найден хост: {host['name']} (ID: {host_id})")
else:
    print("❌ Хост не найден")
    exit()

# 2. Получить items с "Speed" в названии
print("\n" + "=" * 60)
print("2. Получение метрик 'Speed'")
print("=" * 60)
result = zabbix_request("item.get", {
    "output": ["itemid", "name", "key_", "value_type", "units", "lastvalue", "lastclock", "delay"],
    "hostids": [host_id],
    "search": {"name": "Speed"},
    "searchWildcardsEnabled": True,
    "sortfield": "name",
})

if result.get("result"):
    items = result["result"]
    print(f"✅ Найдено метрик: {len(items)}")
    print()
    
    for item in items[:10]:
        last_value = item.get("lastvalue", "N/A")
        units = item.get("units", "")
        
        try:
            value = float(last_value)
            mbps = value / 1_000_000
            gbps = value / 1_000_000_000
            print(f"Item ID: {item['itemid']}")
            print(f"  Name: {item['name']}")
            print(f"  Key: {item['key_']}")
            print(f"  Units: {units}")
            print(f"  Last value (raw): {last_value}")
            print(f"  Last value (Mbps): {mbps:.2f}")
            print(f"  Last value (Gbps): {gbps:.4f}")
            print(f"  Delay: {item.get('delay', 'N/A')}")
            print()
        except:
            print(f"Item ID: {item['itemid']}")
            print(f"  Name: {item['name']}")
            print(f"  Last value: {last_value}")
            print()
else:
    print("❌ Метрики не найдены")

# 3. Получить историю для первой метрики
if result.get("result"):
    first_item = result["result"][0]
    item_id = first_item["itemid"]
    
    print("=" * 60)
    print(f"3. История для метрики {item_id} ({first_item['name']})")
    print("=" * 60)
    
    time_till = int(datetime.now().timestamp())
    time_from = int((datetime.now() - timedelta(hours=1)).timestamp())
    
    result = zabbix_request("history.get", {
        "output": "extend",
        "history": 0,
        "itemids": [item_id],
        "time_from": time_from,
        "time_till": time_till,
        "sortfield": "clock",
        "sortorder": "DESC",
        "limit": 5,
    })
    
    if result.get("result"):
        print(f"✅ Получено записей: {len(result['result'])}")
        for record in result["result"][:5]:
            value = float(record["value"])
            mbps = value / 1_000_000
            clock = int(record["clock"])
            time_str = datetime.fromtimestamp(clock).strftime("%Y-%m-%d %H:%M:%S")
            print(f"  {time_str}: {value} ({mbps:.2f} Mbps)")
    else:
        print("❌ История не получена")

print("\n" + "=" * 60)
print("✅ Проверка завершена")
print("=" * 60)