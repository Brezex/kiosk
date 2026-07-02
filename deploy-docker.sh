#!/bin/bash

set -e

echo "🚀 Развёртывание Zabbix Kiosk..."

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker:"
    echo "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    exit 1
fi

# Проверка docker compose (новый синтаксис)
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не установлен."
    exit 1
fi

# Создание .env если его нет
if [ ! -f .env ]; then
    echo "📝 Создаю .env файл..."
    cat > .env << EOF
# Секретный ключ для JWT токенов (ОБЯЗАТЕЛЬНО измените!)
SECRET_KEY=$(openssl rand -hex 32)

# Домен для CORS (если нужен)
DOMAIN=localhost
EOF
    echo "✅ .env создан. SECRET_KEY сгенерирован автоматически."
fi

# Остановка старых контейнеров
echo "🛑 Останавливаю старые контейнеры..."
docker compose down

# Сборка образов
echo "🔨 Собираю образы..."
docker compose build

# Запуск
echo "▶️  Запускаю контейнеры..."
docker compose up -d

# Ожидание запуска
echo "⏳ Ожидаю запуска сервисов..."
sleep 5

# Проверка статуса
echo "📊 Статус контейнеров:"
docker compose ps

echo ""
echo "✅ Развёртывание завершено!"
echo ""
echo "🌐 Доступ к приложению: http://localhost"
echo "📚 API документация: http://localhost/docs"
echo ""
echo "📋 Логи: docker compose logs -f"
echo "🛑 Остановка: docker compose down"