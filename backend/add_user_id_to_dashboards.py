"""Миграция: добавление user_id в таблицу dashboards."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "zabbix_kiosk.db"

def migrate():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Проверяем, есть ли уже колонка
    cursor.execute("PRAGMA table_info(dashboards)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "user_id" not in columns:
        print("➕ Добавляем колонку user_id в таблицу dashboards...")
        cursor.execute("ALTER TABLE dashboards ADD COLUMN user_id INTEGER REFERENCES users(id)")
        conn.commit()
        print("✅ Миграция завершена!")
    else:
        print("✅ Колонка user_id уже существует, миграция не нужна.")
    
    conn.close()

if __name__ == "__main__":
    migrate()