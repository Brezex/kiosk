"""Проверка полей host и name."""
import httpx

ZABBIX_URL = "http://192.168.215.215/zabbix/api_jsonrpc.php"
ZABBIX_TOKEN = input("Введите токен Zabbix API: ").strip()

payload = {
    "jsonrpc": "2.0",
    "method": "host.get",
    "params": {
        "output": ["hostid", "host", "name", "status"],
        "limit": 10,
    },
    "auth": ZABBIX_TOKEN,
    "id": 1,
}

response = httpx.post(ZABBIX_URL, json=payload, timeout=10, verify=False)
data = response.json()

print("Хосты в Zabbix:")
print("=" * 80)
for host in data.get("result", []):
    host_field = host.get("host", "N/A")
    name_field = host.get("name", "N/A")
    
    # Подсветка различий
    if host_field != name_field:
        marker = "️  РАЗЛИЧАЮТСЯ!"
    else:
        marker = "✓ одинаковые"
    
    print(f"ID: {host['hostid']}")
    print(f"  host: {host_field}")
    print(f"  name: {name_field}")
    print(f"  {marker}")
    print()