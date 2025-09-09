# ARENA Club POS & Inventory

Запуск (Windows/Linux):

1) Установка зависимостей:
   - `npm i`
2) Инициализация БД (SQLite) и сид:
   - `npm run prisma:reset`
3) Dev-запуск (API + Web):
   - `npm run dev`
4) Прод-сборка и запуск:
   - `npm run build`
   - `npm start`

URL:
- API: http://localhost:5050
- Web: http://localhost:5175

Дефолтный админ: admin / admin123

Переменные окружения в `.env.example`

Развёртывание на Windows Server (IIS/Standalone):

1) Установить Node.js LTS и Git. Клонировать репозиторий.
2) В корне проекта скопировать `.env.example` → `.env` и при необходимости задать `JWT_SECRET` и `CORS_ORIGIN`.
3) Установить зависимости и подготовить БД:
   - `npm i`
   - `npm run prisma:reset`
4) Собрать и запустить:
   - `npm run build`
   - `npm start`
5) Открыть порт 5050 в брандмауэре Windows.

Сервис раздаёт собранный фронтенд из `apps/web/dist` по адресу `http://<server>:5050/` и API на `http://<server>:5050/api`.

Запуск как сервис:
- Рекомендуется NSSM: `nssm install arena-pos "C:\Program Files\nodejs\node.exe" "D:\LootBox\apps\api\dist\index.js"`.
- Рабочую директорию указать `D:\LootBox\apps\api`. Перед запуском выполнить сборку: `npm run build` из корня.

---

Полная и подробная инструкция по установке и запуску (Windows Server и локально)

1) Установите инструменты
- Git for Windows: [сайт загрузки](https://git-scm.com/download/win)
- Node.js LTS (рекомендуется LTS): [страница загрузки](https://nodejs.org/en/download)
- (Опционально для сервиса на Windows) NSSM — Non-Sucking Service Manager: [страница загрузки](https://nssm.cc/download)

Проверьте версии:
```powershell
node -v
npm -v
git --version
```

2) Клонируйте репозиторий
```powershell
git clone <ВАШ_GITHUB_REPO_URL> D:\LootBox
cd D:\LootBox
```

3) Настройте переменные окружения
- В корне проекта создайте файл `.env` и укажите значения (пример):
```env
JWT_SECRET=supersecret
CORS_ORIGIN=http://localhost:5175
API_PORT=5050
TELEGRAM_BOT_TOKEN=8475679792:AAHVGHAfx3hIoSPOPMAqcJSnkOlbHpzgJzs
TELEGRAM_CHAT_ID=-4614810639
```
Примечания:
- `CORS_ORIGIN` укажите на домен, откуда будет открываться фронтенд (в dev это `http://localhost:5175`). В продакшене фронт раздаётся самим API, поэтому можно оставить значение по умолчанию.
- `API_PORT` — порт, на котором запустится API и будет раздаваться собранный фронт.

4) Установите зависимости и подготовьте БД
```powershell
npm install
npm run prisma:reset
```
Команда `prisma:reset` синхронизирует схему SQLite и выполнит сидинг админа: `admin / admin123`.

5) Запуск в режиме разработки (горячая перезагрузка)
```powershell
npm run dev
```
Откройте:
- Web dev (Vite): `http://localhost:5175`
- API: `http://localhost:5050`

6) Продакшн-сборка и запуск локально
```powershell
npm run build
npm start
```
После старта API:
- Приложение будет доступно на `http://localhost:5050`
- API — на `http://localhost:5050/api`

6.1) Docker (локальный запуск)

Сборка образа (из корня проекта):
```powershell
docker build -t arenapos:latest .
```

Создание тома для БД SQLite и запуск контейнера:
```powershell
docker volume create arenapos_data
docker run -d --name arenapos \ 
  -p 5050:5050 \ 
  -e NODE_ENV=production \ 
  -e API_PORT=5050 \ 
  -e JWT_SECRET=supersecret \ 
  -e TELEGRAM_BOT_TOKEN=8475679792:AAHVGHAfx3hIoSPOPMAqcJSnkOlbHpzgJzs \ 
  -e TELEGRAM_CHAT_ID=-4614810639 \ 
  -v arenapos_data:/app/apps/api/prisma \ 
  arenapos:latest
```

Примечания:
- Внутри контейнера API доступен на `5050`, фронт раздается тем же процессом.
- Том примонтирован к каталогу `apps/api/prisma`, чтобы сохранялась база данных SQLite (`dev.db`).
- Остановить/удалить:
```powershell
docker stop arenapos
docker rm arenapos
```

7) Развёртывание на Windows Server (standalone)
- Откройте порт в брандмауэре Windows (пример для PowerShell — для входящих TCP 5050):
```powershell
New-NetFirewallRule -DisplayName "ArenaPOS_5050" -Direction Inbound -Protocol TCP -LocalPort 5050 -Action Allow
```
- Соберите проект:
```powershell
cd D:\LootBox
npm install
npm run build
```
- Запуск вручную (проверка):
```powershell
npm start
```

8) Запуск как Windows-служба через NSSM (рекомендуется для продакшена)
- Скачайте NSSM: [страница загрузки](https://nssm.cc/download) и распакуйте.
- Установите службу (от Администратора):
```powershell
"C:\path\to\nssm.exe" install arena-pos "C:\Program Files\nodejs\node.exe" "D:\LootBox\apps\api\dist\index.js"
```
- В поле «Startup directory» укажите: `D:\LootBox\apps\api`
- В «I/O» можно направить stdout/stderr в файлы логов (по желанию).
- Сохраните и запустите службу:
```powershell
"C:\path\to\nssm.exe" start arena-pos
```
- Остановить/удалить службу:
```powershell
"C:\path\to\nssm.exe" stop arena-pos
"C:\path\to\nssm.exe" remove arena-pos confirm
```

8.1) Автозапуск Docker-контейнера на Windows

Вариант A — перезапуск при падении и автозапуск при старте Docker Desktop:
```powershell
docker update --restart=always arenapos
```
Убедитесь, что Docker Desktop настроен «Start Docker Desktop when you log in».

Вариант B — через Планировщик заданий Windows:
1. Откройте «Планировщик заданий» → «Создать задачу…».
2. Триггеры: «При входе в систему» для вашего пользователя или «При запуске».
3. Действие: Программа/скрипт: `powershell.exe`
   Аргументы:
```powershell
-NoProfile -ExecutionPolicy Bypass -Command "docker start arenapos"
```
4. В «Параметры» включите «Запускать с наивысшими правами».

Вариант C — как Windows-служба через NSSM (для Docker):
```powershell
"C:\path\to\nssm.exe" install arenapos-docker "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" "-NoProfile -ExecutionPolicy Bypass -Command docker start arenapos"
"C:\path\to\nssm.exe" set arenapos-docker AppDirectory C:\Users\<user>
"C:\path\to\nssm.exe" start arenapos-docker
```

9) Обновление сервера до новой версии
```powershell
cd D:\LootBox
git pull
npm install
npm run build
Restart-Service arena-pos   # если используете NSSM+службу (или stop/start)
```

10) Linux (Ubuntu) — кратко
- Установите Node.js (через nvm) и Git:
```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install --lts
node -v && npm -v
```
- Клонирование и подготовка:
```bash
git clone <ВАШ_GITHUB_REPO_URL> ~/LootBox
cd ~/LootBox
cp .env.example .env  # при наличии
npm install
npm run prisma:reset
npm run build
npm start
```
- Для автозапуска используйте systemd (пример юнита `/etc/systemd/system/arena-pos.service`):
```ini
[Unit]
Description=Arena POS API + Web
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/<user>/LootBox/apps/api
ExecStart=/usr/bin/node /home/<user>/LootBox/apps/api/dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
Команды:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now arena-pos
sudo systemctl status arena-pos
```

11) Тестовые учётные данные
- Админ: `admin / admin123`

12) Частые проблемы и решения
- Порт 5050 занят (Windows):
```powershell
netstat -ano | findstr :5050
taskkill /F /PID <PID>
```
Либо временно запустить на другом порту:
```powershell
$env:API_PORT=5051; npm start
```
- CORS/редирект на логин: Убедитесь, что `CORS_ORIGIN` соответствует адресу фронтенда. В продакшене фронт раздаёт сам API — можно оставить `http://localhost:5175` или убрать переменную.
- Пустые категории/данные: выполните сидинг `npm run prisma:reset` (внимание — очистит БД!).

13) Скрипты npm (сводно)
- `npm run dev` — dev-режим (Vite + API)
- `npm run build` — сборка web и api
- `npm start` — запуск API (раздаёт `apps/web/dist`)
- `npm run prisma:reset` — синхронизация схемы и сиды

