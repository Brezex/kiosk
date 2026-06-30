#!/bin/bash

set -e

echo "🚀 Деплой Zabbix Kiosk через Docker..."

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker:"
    echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "   sh get-docker.sh"
    exit 1
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose:"
    echo "   apt-get install docker-compose"
    exit 1
fi

# Остановка старых контейнеров
echo "🛑 Остановка старых контейнеров..."
docker-compose down || true

# Сборка образа
echo "🔨 Сборка Docker-образа..."
docker-compose build

# Запуск контейнера
echo "▶️  Запуск контейнера..."
docker-compose up -d

# Ожидание запуска
echo "⏳ Ожидание запуска сервиса..."
sleep 10

# Проверка статуса
echo "📊 Статус контейнера:"
docker-compose ps

echo ""
echo "✅ Деплой завершён!"
echo ""
echo "🌐 Доступ:"
echo "   Админка: http://$(hostname -I | awk '{print $1}'):8000"
echo "   API Docs: http://$(hostname -I | awk '{print $1}'):8000/docs"
echo ""
echo "🔧 Управление:"
echo "   docker-compose logs -f        # Логи"
echo "   docker-compose restart        # Перезапуск"
echo "   docker-compose down           # Остановка"
echo ""