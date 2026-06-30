# Multi-stage build для оптимизации размера

# Stage 1: Сборка фронтенда
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем package.json и package-lock.json
COPY frontend/package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код фронтенда
COPY frontend/ ./

# Собираем production-версию
RUN npm run build

# Stage 2: Backend + готовый фронтенд
FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements.txt
COPY backend/requirements.txt ./

# Устанавливаем Python-зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем backend код
COPY backend/ ./backend/

# Копируем собранный фронтенд из stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Создаём директорию для данных
RUN mkdir -p /app/data

# Устанавливаем переменные окружения
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:///./data/zabbix_kiosk.db
ENV SECRET_KEY=change-this-in-production-very-secret-key-min-32-chars
ENV PORT=8000

# Открываем порт
EXPOSE 8000

# Рабочая директория
WORKDIR /app/backend

# Команда запуска
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]