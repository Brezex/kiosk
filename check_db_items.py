"""Проверка item_id из БД."""
import httpx
from datetime import datetime, timedelta

ZABBIX_URL = "http://192.168.215.215/zabbix/api_jsonrpc.php"
ZABBIX_TOKEN = input("Введите токен Zabbix API: ").strip()

# Item ID из БД (панель "ТЕСТ")
ITEM_IDS = ["126541", "126542", "126549"]

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

print("=" * 60)
print(f"Проверка item_id из БД: {ITEM_IDS}")
print("=" * 60)

result = zabbix_request("item.get", {
    "output": ["itemid", "name", "key_", "value_type", "units", "lastvalue"],
    "itemids": ITEM_IDS,
})

if not result.get("result"):
    print("❌ Метрики не найдены")
    exit()

items = result["result"]
print(f"✅ Найдено метрик: {len(items)}")
print()

for item in items:
    print(f"Item ID: {item['itemid']}")
    print(f"  Name: {item['name']}")
    print(f"  Key: {item['key_']}")
    print(f"  Units: {item.get('units', '')}")
    print(f"  Value type: {item['value_type']}")
    
    try:
        value = float(item['lastvalue'])
        if value > 1_000_000_000:
            display = f"{value/1_000_000_000:.2f} Gbps"
        elif value > 1_000_000:
            display = f"{value/1_000_000:.2f} Mbps"
        elif value > 1_000:
            display = f"{value/1_000:.2f} Kbps"
        else:
            display = f"{value:.2f} bps"
        
        print(f"  Last value: {display}")
        
        # Определяем тип метрики
        if 'speed' in item['key_'].lower():
            print(f"  ⚠️  ЭТО SPEED (скорость порта, не трафик!)")
        elif 'in' in item['key_'].lower() and 'error' not in item['key_'].lower():
            print(f"  ✅ Это входящий трафик (Bits received)")
        elif 'out' in item['key_'].lower() and 'error' not in item['key_'].lower():
            print(f"  ✅ Это исходящий трафик (Bits sent)")
        else:
            print(f"  ❓ Неизвестный тип")
    except:
        print(f"  Last value: {item['lastvalue']}")
    
    print()

# История для всех метрик
print("=" * 60)
print("История за последний час")
print("=" * 60)

time_till = int(datetime.now().timestamp())
time_from = int((datetime.now() - timedelta(hours=1)).timestamp())

for item in items:
    print(f"\n📊 {item['name']} (ID: {item['itemid']})")
    print("-" * 60)
    
    result = zabbix_request("history.get", {
        "output": "extend",
        "history": int(item['value_type']),
        "itemids": [item['itemid']],
        "time_from": time_from,
        "time_till": time_till,
        "sortfield": "clock",
        "sortorder": "DESC",
        "limit": 5,
    })
    
    if result.get("result"):
        for record in result["result"][:5]:
            value = float(record["value"])
            mbps = value / 1_000_000
            clock = int(record["clock"])
            time_str = datetime.fromtimestamp(clock).strftime("%H:%M:%S")
            print(f"  {time_str}: {mbps:.2f} Mbps")
    else:
        print("  ❌ История не получена")

print("\n" + "=" * 60)
print("✅ Проверка завершена")
print("=" * 60)