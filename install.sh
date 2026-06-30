#!/bin/bash

set -e

echo "🚀 Установка Zabbix Kiosk на Debian 12..."

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Пожалуйста, запустите скрипт с правами root (sudo)"
    exit 1
fi

# Переменные
APP_DIR="/opt/zabbix-kiosk"
APP_USER="kiosk"
PYTHON_VERSION="3.11"

# 1. Установка зависимостей
echo "📦 Установка системных зависимостей..."
apt-get update
apt-get install -y \
    python${PYTHON_VERSION} \
    python${PYTHON_VERSION}-venv \
    python3-pip \
    nodejs \
    npm \
    curl \
    git

# 2. Создание пользователя
echo "👤 Создание пользователя ${APP_USER}..."
if ! id "${APP_USER}" &>/dev/null; then
    useradd -r -s /bin/false -m -d ${APP_DIR} ${APP_USER}
fi

# 3. Создание директории
echo "📁 Создание директории ${APP_DIR}..."
mkdir -p ${APP_DIR}
chown ${APP_USER}:${APP_USER} ${APP_DIR}

# 4. Копирование файлов
echo "📂 Копирование файлов..."
cp -r backend ${APP_DIR}/
cp -r frontend ${APP_DIR}/
cp requirements.txt ${APP_DIR}/backend/ 2>/dev/null || true

# 5. Сборка фронтенда
echo "🎨 Сборка фронтенда..."
cd ${APP_DIR}/frontend
npm install
npm run build
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# 6. Создание виртуального окружения Python
echo "🐍 Создание виртуального окружения Python..."
cd ${APP_DIR}
python${PYTHON_VERSION} -m venv venv
chown -R ${APP_USER}:${APP_USER} venv

# 7. Установка Python-зависимостей
echo "📦 Установка Python-зависимостей..."
sudo -u ${APP_USER} ${APP_DIR}/venv/bin/pip install --upgrade pip
sudo -u ${APP_USER} ${APP_DIR}/venv/bin/pip install -r backend/requirements.txt

# 8. Создание директории для данных
echo "💾 Создание директории для данных..."
mkdir -p ${APP_DIR}/data
chown ${APP_USER}:${APP_USER} ${APP_DIR}/data

# 9. Создание администратора
echo "👑 Создание администратора..."
cd ${APP_DIR}/backend
sudo -u ${APP_USER} ${APP_DIR}/venv/bin/python create_admin.py

# 10. Установка systemd service
echo "⚙️  Установка systemd service..."
cp zabbix-kiosk.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable zabbix-kiosk
systemctl start zabbix-kiosk

# 11. Настройка firewall (если ufw активен)
if command -v ufw &> /dev/null; then
    echo "🔥 Настройка firewall..."
    ufw allow 8000/tcp
fi

echo ""
echo "✅ Установка завершена!"
echo ""
echo "📊 Статус сервиса:"
systemctl status zabbix-kiosk --no-pager
echo ""
echo "🌐 Доступ:"
echo "   Админка: http://$(hostname -I | awk '{print $1}'):8000"
echo "   API Docs: http://$(hostname -I | awk '{print $1}'):8000/docs"
echo ""
echo "🔧 Управление сервисом:"
echo "   systemctl start zabbix-kiosk    # Запустить"
echo "   systemctl stop zabbix-kiosk     # Остановить"
echo "   systemctl restart zabbix-kiosk  # Перезапустить"
echo "   systemctl status zabbix-kiosk   # Статус"
echo "   journalctl -u zabbix-kiosk -f   # Логи"
echo ""