# 🖥️ Zabbix Kiosk — Система мониторинга

Веб-приложение для отображения дашбордов Zabbix в режиме киоска на больших экранах.

## ✨ Возможности

- 📊 **Дашборды** — создание и редактирование дашбордов с панелями
- 🔄 **Автоматическая ротация** — переключение между дашбордами по таймеру
- 🔔 **Уведомления в реальном времени** — интеграция с Zabbix API
- 📅 **Календарные напоминания** — плановые уведомления
- 👥 **Разделение ролей** — admin (полный доступ) и viewer (только просмотр)
- 🖥️ **Режим киоска** — скрытие курсора, полноэкранный режим
- 📤 **Импорт/экспорт** — перенос дашбордов между серверами

## 🛠️ Технологии

### Backend
- Python 3.13
- FastAPI
- SQLAlchemy + aiosqlite
- JWT авторизация
- bcrypt для хеширования паролей

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Axios

## 🚀 Быстрый старт

### Требования
- Python 3.11+
- Node.js 18+
- npm

### Установка

```bash
# Клонировать репозиторий
git clone <your-repo-url>
cd kiosk

# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python create_admin.py  # Создать админа (admin/admin123)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (в новом терминале)
cd frontend
npm install
npm run dev

Админка: http://localhost:5173/admin
Киоск: http://localhost:5173/kiosk
API: http://localhost:8000/docs

