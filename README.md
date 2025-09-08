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

Дефолтный админ: admin@local / admin123

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
