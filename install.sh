#!/bin/bash
# ============================================================================
# Zabbix Kiosk — установочный скрипт для Debian 12
# ============================================================================
set -e

APP_NAME="zabbix-kiosk"
APP_DIR="/opt/${APP_NAME}"
CONFIG_DIR="/etc/${APP_NAME}"
CONFIG_FILE="${CONFIG_DIR}/config.env"
DATA_DIR="${APP_DIR}/data"
SERVICE_USER="${APP_NAME}"
PORT=3001

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ============ Проверки ============
check_root() {
    if [ "$EUID" -ne 0 ]; then
        err "Скрипт нужно запускать от root (sudo)"
        exit 1
    fi
}

check_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" != "debian" ]; then
            warn "Скрипт рассчитан на Debian. Текущая ОС: $ID. Продолжаем..."
        else
            log "ОС: $PRETTY_NAME"
        fi
    fi
}

# ============ Установка зависимостей ============
install_dependencies() {
    log "Обновление пакетов..."
    apt-get update -qq
    
    log "Установка необходимых пакетов..."
    apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        git \
        ufw \
        openssl
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log "Установка Docker..."
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/debian/gpg | \
            gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
          https://download.docker.com/linux/debian \
          $(lsb_release -cs) stable" | \
          tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
        systemctl enable docker
        systemctl start docker
        log "Docker установлен: $(docker --version)"
    else
        log "Docker уже установлен: $(docker --version)"
    fi
    
    # Docker Compose (если нет плагина)
    if ! docker compose version &> /dev/null; then
        log "Установка Docker Compose..."
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
        curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
            -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
}

# ============ Создание пользователя ============
create_user() {
    if ! id -u "${SERVICE_USER}" &>/dev/null; then
        log "Создание пользователя ${SERVICE_USER}..."
        useradd -r -m -d "${APP_DIR}" -s /usr/sbin/nologin "${SERVICE_USER}"
    else
        log "Пользователь ${SERVICE_USER} уже существует"
    fi
}

# ============ Генерация секретного ключа ============
generate_secret() {
    if [ ! -f "${CONFIG_FILE}" ]; then
        log "Генерация секретного ключа..."
        # 32 байта в base64 для Fernet
        SECRET=$(openssl rand -base64 32)
        
        mkdir -p "${CONFIG_DIR}"
        cat > "${CONFIG_FILE}" <<EOF
# Zabbix Kiosk configuration
# Сгенерировано автоматически при установке

SECRET_KEY=${SECRET}
DATABASE_URL=sqlite+aiosqlite:////data/app.db
KIOSK_ROTATION_INTERVAL=30
KIOSK_NOTIFICATION_POLL_INTERVAL=10
ZABBIX_REQUEST_TIMEOUT=10
LOG_LEVEL=INFO
DATA_DIR=${DATA_DIR}
EOF
        chmod 600 "${CONFIG_FILE}"
        log "Конфиг создан: ${CONFIG_FILE}"
    else
        log "Конфиг уже существует: ${CONFIG_FILE}"
    fi
}

# ============ Копирование файлов ============
copy_files() {
    log "Копирование файлов в ${APP_DIR}..."
    
    # Если скрипт запущен из директории проекта
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    if [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
        mkdir -p "${APP_DIR}"
        cp -r "${SCRIPT_DIR}/backend" "${APP_DIR}/"
        cp -r "${SCRIPT_DIR}/frontend" "${APP_DIR}/"
        cp "${SCRIPT_DIR}/docker-compose.yml" "${APP_DIR}/"
        cp "${SCRIPT_DIR}/nginx.conf" "${APP_DIR}/"
        cp "${SCRIPT_DIR}/zabbix-kiosk.service" /etc/systemd/system/ 2>/dev/null || true
        
        chown -R "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"
        log "Файлы скопированы"
    else
        warn "docker-compose.yml не найден в ${SCRIPT_DIR}"
        warn "Убедитесь, что скрипт запущен из директории проекта"
    fi
}

# ============ Сборка Docker-образов ============
build_images() {
    log "Сборка Docker-образов (это может занять несколько минут)..."
    cd "${APP_DIR}"
    
    # Сборка бэкенда
    docker compose build backend
    
    # Сборка фронтенда и копирование статики в бэкенд
    log "Сборка фронтенда..."
    docker run --rm -v "${APP_DIR}/frontend:/app" -w /app node:20-alpine sh -c "
        npm install --silent && npm run build
    "
    
    log "Образы собраны"
}

# ============ Создание директорий ============
create_dirs() {
    mkdir -p "${DATA_DIR}"
    chown -R "${SERVICE_USER}:${SERVICE_USER}" "${DATA_DIR}"
    log "Директория данных: ${DATA_DIR}"
}

# ============ Настройка UFW ============
setup_firewall() {
    if command -v ufw &> /dev/null; then
        log "Настройка UFW: открытие порта ${PORT}..."
        ufw allow ${PORT}/tcp comment "Zabbix Kiosk" || true
        # Включаем UFW, если он выключен
        ufw --force enable || true
    else
        warn "UFW не установлен. Пропускаем настройку firewall."
    fi
}

# ============ Запуск systemd-сервиса ============
setup_service() {
    log "Настройка systemd-сервиса..."
    systemctl daemon-reload
    systemctl enable "${APP_NAME}.service"
    systemctl restart "${APP_NAME}.service"
    
    # Ждём запуска
    sleep 5
    
    if systemctl is-active --quiet "${APP_NAME}.service"; then
        log "✅ Сервис запущен"
    else
        warn "Сервис не запустился. Проверьте: journalctl -u ${APP_NAME}.service"
    fi
}

# ============ Вывод итоговой информации ============
print_summary() {
    echo ""
    echo "============================================================"
    echo -e "${GREEN}✅ Zabbix Kiosk успешно установлен!${NC}"
    echo "============================================================"
    echo ""
    echo "📍 Адрес:        http://$(hostname -I | awk '{print $1}'):${PORT}"
    echo "📍 Kiosk mode:   http://$(hostname -I | awk '{print $1}'):${PORT}/kiosk"
    echo "📍 Admin panel:  http://$(hostname -I | awk '{print $1}'):${PORT}/admin"
    echo ""
    echo "🔐 Логин по умолчанию: admin"
    echo "🔑 Пароль по умолчанию: admin"
    echo "⚠️  При первом входе система попросит сменить пароль!"
    echo ""
    echo "📁 Директория приложения: ${APP_DIR}"
    echo "📁 Конфигурация:          ${CONFIG_FILE}"
    echo "📁 База данных:           ${DATA_DIR}/app.db"
    echo ""
    echo "🛠️  Команды управления:"
    echo "   systemctl status  ${APP_NAME}    # Статус"
    echo "   systemctl restart ${APP_NAME}    # Перезапуск"
    echo "   journalctl -u ${APP_NAME} -f     # Логи"
    echo ""
    echo "📖 Документация: ${APP_DIR}/README.md"
    echo "============================================================"
}

# ============ Основной поток ============
main() {
    echo ""
    echo "============================================================"
    echo "   Zabbix Kiosk — установка"
    echo "============================================================"
    echo ""
    
    check_root
    check_os
    install_dependencies
    create_user
    generate_secret
    copy_files
    create_dirs
    build_images
    setup_firewall
    setup_service
    print_summary
}

main "$@"