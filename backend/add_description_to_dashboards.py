"""Миграция: добавление description в таблицу dashboards."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "zabbix_kiosk.db"

def migrate():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Проверяем существующие колонки
    cursor.execute("PRAGMA table_info(dashboards)")
    columns = [row[1] for row in cursor.fetchall()]
    
    # Добавляем description, если нет
    if "description" not in columns:
        print("➕ Добавляем колонку description в таблицу dashboards...")
        cursor.execute("ALTER TABLE dashboards ADD COLUMN description TEXT")
        conn.commit()
        print("✅ Колонка description добавлена!")
    else:
        print("✅ Колонка description уже существует.")
    
    # Добавляем user_id, если нет (на всякий случай)
    if "user_id" not in columns:
        print("➕ Добавляем колонку user_id в таблицу dashboards...")
        cursor.execute("ALTER TABLE dashboards ADD COLUMN user_id INTEGER REFERENCES users(id)")
        conn.commit()
        print("✅ Колонка user_id добавлена!")
    else:
        print("✅ Колонка user_id уже существует.")
    
    conn.close()
    print("\n✅ Миграция завершена!")

if __name__ == "__main__":
    migrate()