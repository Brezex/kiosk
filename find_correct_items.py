"""Поиск правильных метрик трафика для интерфейсов."""
import httpx

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

# Интерфейсы из БД (нужно найти для них Bits received/sent)
INTERFACES = [
    "ethernet1.2049",
    "ethernet1.2050",
    "ethernet4.2051",
]

print("=" * 60)
print(f"Поиск метрик трафика для хоста {HOST_ID}")
print("=" * 60)

# Получить все метрики хоста
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
print(f"✅ Всего метрик: {len(items)}")
print()

# Найти метрики для нужных интерфейсов
for interface in INTERFACES:
    print(f"\n{'=' * 60}")
    print(f"🔍 Интерфейс: {interface}")
    print('=' * 60)
    
    # Ищем метрики, содержащие имя интерфейса
    matching_items = [i for i in items if interface in i['name']]
    
    if not matching_items:
        print(f"❌ Метрики для {interface} не найдены")
        continue
    
    print(f"✅ Найдено метрик: {len(matching_items)}")
    print()
    
    # Показать все метрики для этого интерфейса
    for item in matching_items:
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
        
        # Определяем тип
        if 'speed' in item['key_'].lower():
            icon = "⚠️"
            type_name = "SPEED (скорость порта)"
        elif 'in' in item['key_'].lower() and 'error' not in item['key_'].lower() and 'discard' not in item['key_'].lower():
            icon = "📥"
            type_name = "BITS RECEIVED (входящий трафик)"
        elif 'out' in item['key_'].lower() and 'error' not in item['key_'].lower() and 'discard' not in item['key_'].lower():
            icon = "📤"
            type_name = "BITS SENT (исходящий трафик)"
        else:
            icon = ""
            type_name = "OTHER"
        
        print(f"{icon} {type_name}")
        print(f"   Item ID: {item['itemid']}")
        print(f"   Name: {item['name']}")
        print(f"   Key: {item['key_']}")
        print(f"   Value: {display}")
        print()
    
    # Показать правильные метрики для копирования
    print(f"\n✅ ПРАВИЛЬНЫЕ МЕТРИКИ ДЛЯ {interface}:")
    print("-" * 60)
    
    bits_received = [i for i in matching_items if 'bits received' in i['name'].lower()]
    bits_sent = [i for i in matching_items if 'bits sent' in i['name'].lower()]
    
    if bits_received:
        item = bits_received[0]
        print(f"📥 Bits received: Item ID = {item['itemid']}")
        print(f"   Name: {item['name']}")
    else:
        print("❌ Bits received не найдена")
    
    if bits_sent:
        item = bits_sent[0]
        print(f"📤 Bits sent: Item ID = {item['itemid']}")
        print(f"   Name: {item['name']}")
    else:
        print("❌ Bits sent не найдена")

print("\n" + "=" * 60)
print("✅ Поиск завершён")
print("=" * 60)
print("\n📋 ИНСТРУКЦИЯ:")
print("1. Откройте дашборд в редакторе")
print("2. Нажмите 'Редактировать' на панели 'ТЕСТ'")
print("3. Удалите старые метрики (Speed)")
print("4. Добавьте новые метрики (Bits received / Bits sent)")
print("5. Используйте Item ID из списка выше")
print("=" * 60)