"""Проверка метрик интерфейсов по host_id."""
import httpx
from datetime import datetime, timedelta

ZABBIX_URL = "http://192.168.215.215/zabbix/api_jsonrpc.php"
ZABBIX_TOKEN = input("Введите токен Zabbix API: ").strip()
HOST_ID = "11342"  # Известный из БД

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

# 1. Проверка хоста
print("=" * 60)
print(f"1. Проверка хоста ID={HOST_ID}")
print("=" * 60)
result = zabbix_request("host.get", {
    "output": ["hostid", "host", "name"],
    "hostids": [HOST_ID],
})
if result.get("result"):
    host = result["result"][0]
    print(f"✅ host: {host['host']}")
    print(f"✅ name: {host['name']}")
else:
    print("❌ Хост не найден по ID")
    exit()

# 2. Все метрики, связанные с интерфейсами (ключ содержит net.if)
print("\n" + "=" * 60)
print("2. Все метрики интерфейсов (ключ net.if*)")
print("=" * 60)
result = zabbix_request("item.get", {
    "output": ["itemid", "name", "key_", "value_type", "units", "lastvalue", "delay"],
    "hostids": [HOST_ID],
    "search": {"key_": "net.if"},
    "searchWildcardsEnabled": True,
    "sortfield": "name",
    "limit": 100,
})

if result.get("result"):
    items = result["result"]
    print(f"✅ Найдено метрик: {len(items)}")
    print()
    
    # Группируем по типу
    by_type = {}
    for item in items:
        key = item['key_']
        # Определяем тип
        if 'speed' in key.lower():
            t = "⚡ SPEED (скорость порта)"
        elif 'in' in key.lower() and 'error' not in key.lower() and 'discard' not in key.lower():
            t = "📥 INCOMING (входящий трафик)"
        elif 'out' in key.lower() and 'error' not in key.lower() and 'discard' not in key.lower():
            t = "📤 OUTGOING (исходящий трафик)"
        elif 'error' in key.lower():
            t = "⚠️ ERRORS"
        elif 'discard' in key.lower():
            t = "🗑️ DISCARDS"
        else:
            t = "📋 OTHER"
        
        by_type.setdefault(t, []).append(item)
    
    for type_name, type_items in by_type.items():
        print(f"\n{type_name} ({len(type_items)} метрик):")
        print("-" * 60)
        for item in type_items[:3]:  # Первые 3 каждого типа
            try:
                value = float(item['lastvalue'])
                if 'speed' in item['key_'].lower():
                    mbps = value / 1_000_000
                    gbps = value / 1_000_000_000
                    display = f"{value:.0f} bps = {mbps:.0f} Mbps = {gbps:.2f} Gbps"
                else:
                    mbps = value / 1_000_000
                    display = f"{value:.0f} bps = {mbps:.2f} Mbps"
            except:
                display = item['lastvalue']
            
            print(f"  ID: {item['itemid']}")
            print(f"  Name: {item['name']}")
            print(f"  Key: {item['key_']}")
            print(f"  Value: {display}")
            print(f"  Units: {item.get('units', '')}")
            print(f"  Value type: {item['value_type']}")
            print()
        
        if len(type_items) > 3:
            print(f"  ... и ещё {len(type_items) - 3} метрик этого типа")

# 3. История для Incoming и Outgoing (не Speed!)
print("\n" + "=" * 60)
print("3. История для метрик трафика (не Speed)")
print("=" * 60)

traffic_items = [i for i in items if ('in' in i['key_'].lower() or 'out' in i['key_'].lower()) 
                 and 'error' not in i['key_'].lower() 
                 and 'discard' not in i['key_'].lower()
                 and 'speed' not in i['key_'].lower()]

if traffic_items:
    time_till = int(datetime.now().timestamp())
    time_from = int((datetime.now() - timedelta(hours=1)).timestamp())
    
    # Берём первые 2 метрики (in + out)
    for item in traffic_items[:2]:
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
                kbps = value / 1_000
                clock = int(record["clock"])
                time_str = datetime.fromtimestamp(clock).strftime("%H:%M:%S")
                print(f"  {time_str}: {kbps:.2f} Kbps = {mbps:.2f} Mbps")
        else:
            print("  ❌ История не получена")
else:
    print("❌ Метрики трафика не найдены!")

print("\n" + "=" * 60)
print("✅ Проверка завершена")
print("=" * 60)