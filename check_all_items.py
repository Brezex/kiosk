"""Проверка всех метрик хоста."""
import httpx
from datetime import datetime, timedelta

ZABBIX_URL = "http://192.168.215.215/zabbix/api_jsonrpc.php"
ZABBIX_TOKEN = input("Введите токен Zabbix API: ").strip()
HOST_ID = "11342"

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

# 1. Получить ВСЕ метрики хоста (без фильтра)
print("=" * 60)
print(f"1. Все метрики хоста ID={HOST_ID}")
print("=" * 60)
result = zabbix_request("item.get", {
    "output": ["itemid", "name", "key_", "value_type", "units", "lastvalue"],
    "hostids": [HOST_ID],
    "sortfield": "name",
    "limit": 1000,
})

if not result.get("result"):
    print("❌ Метрики не найдены")
    exit()

items = result["result"]
print(f"✅ Найдено метрик: {len(items)}")
print()

# 2. Показать все метрики, содержащие "interface" или "ethernet" в имени
print("=" * 60)
print("2. Метрики интерфейсов (по имени)")
print("=" * 60)
interface_items = [i for i in items if 'interface' in i['name'].lower() or 'ethernet' in i['name'].lower()]

if interface_items:
    print(f"✅ Найдено метрик интерфейсов: {len(interface_items)}")
    print()
    
    # Группируем по типу
    for item in interface_items[:20]:  # Первые 20
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
        except:
            display = item['lastvalue']
        
        print(f"ID: {item['itemid']}")
        print(f"  Name: {item['name']}")
        print(f"  Key: {item['key_']}")
        print(f"  Value: {display}")
        print(f"  Units: {item.get('units', '')}")
        print(f"  Value type: {item['value_type']}")
        print()
else:
    print("❌ Метрики интерфейсов не найдены")
    print("\nПоказываю первые 20 метрик хоста:")
    for item in items[:20]:
        print(f"  - {item['name']} (Key: {item['key_']})")

# 3. История для первых 2 метрик интерфейсов
if interface_items:
    print("=" * 60)
    print("3. История для метрик интерфейсов")
    print("=" * 60)
    
    time_till = int(datetime.now().timestamp())
    time_from = int((datetime.now() - timedelta(hours=1)).timestamp())
    
    for item in interface_items[:2]:
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