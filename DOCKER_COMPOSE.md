# Docker Compose для ARENA Club POS

## Быстрый запуск

### 1. С Docker Compose (рекомендуется)

```bash
# Сборка и запуск
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Остановка с удалением volumes (ОСТОРОЖНО: удалит базу данных!)
docker-compose down -v
```

### 2. С обычным Docker

```bash
# Сборка образа
docker build -t arenapos:latest .

# Создание сети
docker network create arena-net

# Создание volume для базы данных
docker volume create arenapos_data

# Запуск контейнера
docker run -d --name arenapos \
  --network arena-net \
  --restart always \
  -p 5050:5050 \
  -v arenapos_data:/app/apps/api/prisma \
  -e API_PORT=5050 \
  -e JWT_SECRET=supersecret \
  -e CORS_ORIGIN=https://arena.local \
  -e TELEGRAM_BOT_TOKEN=8475679792:AAHVGHAfx3hIoSPOPMAqcJSnkOlbHpzgJzs \
  -e TELEGRAM_CHAT_ID=-4614810639 \
  -e NODE_ENV=production \
  arenapos:latest
```

## Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# Основные настройки
NODE_ENV=production
API_PORT=5050
JWT_SECRET=supersecret
CORS_ORIGIN=https://arena.local

# Telegram уведомления
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_CHAT_ID=ваш_chat_id

# Прокси для Telegram (опционально)
HTTPS_PROXY=http://proxy-server:port
```

## Доступ к приложению

- **Веб-интерфейс**: http://localhost:5050
- **API**: http://localhost:5050/api
- **Логин**: admin / admin123

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f arenapos

# Перезапуск сервиса
docker-compose restart

# Обновление до новой версии
git pull
docker-compose up -d --build

# Резервное копирование базы данных
docker cp arenapos:/app/apps/api/prisma/app.db ./backup.db

# Восстановление базы данных
docker cp ./backup.db arenapos:/app/apps/api/prisma/app.db
docker-compose restart
```

## Структура volumes

- `arenapos_data` - содержит базу данных SQLite (`app.db`)

## Сеть

- `arena-net` - изолированная сеть для контейнера

## Мониторинг

```bash
# Статус контейнера
docker-compose ps

# Использование ресурсов
docker stats arenapos

# Проверка здоровья
curl http://localhost:5050/api/me
```
