"""Миграция: добавление update_interval в таблицу dashboards."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "zabbix_kiosk.db"

def migrate():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Проверяем существующие колонки
    cursor.execute("PRAGMA table_info(dashboards)")
    columns = [row[1] for row in cursor.fetchall()]
    
    print(f"Текущие колонки в таблице dashboards: {columns}")
    
    # Добавляем update_interval, если нет
    if "update_interval" not in columns:
        print("➕ Добавляем колонку update_interval...")
        cursor.execute("ALTER TABLE dashboards ADD COLUMN update_interval INTEGER DEFAULT 30")
        conn.commit()
        print("✅ Колонка update_interval добавлена!")
    else:
        print("✅ Колонка update_interval уже существует.")
    
    conn.close()
    print("\n✅ Миграция завершена!")

if __name__ == "__main__":
    migrate()