# 🚀 Деплой Zabbix Kiosk на Debian 12

## 📋 Требования

- Debian 12 (Bookworm)
- Root доступ (sudo)
- Минимум 1 GB RAM
- 2 GB свободного места

## 🐳 Вариант 1: Docker (рекомендуется)

### Установка Docker

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo apt-get install docker-compose

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER