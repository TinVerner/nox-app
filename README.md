# NOX

Клубное приложение: React в `client/`, Express в `server/`. Точка входа API — `server/index.js`. Её вызывают `npm start`, `npm run dev` и образ API.

## Локально

Нужны Node.js и PostgreSQL. В `server/.env` лежат `DATABASE_URL` и `SESSION_SECRET`. Без `SESSION_SECRET` процесс не стартует.

```bash
cd server
npm install
npx prisma generate
npm run dev
```

`npm run dev` — `node --watch index.js`. `npm start` — `node index.js`. Порт `3000` или `PORT`.

Проверка: [http://localhost:3000/api/health](http://localhost:3000/api/health) отвечает `{ "ok": true, "message": "NOX API hello" }`. Сокет расписания: `ws://localhost:3000/ws`.

Клиент:

```bash
cd client
npm install
npm run dev
```

Vite открывает [http://localhost:5173](http://localhost:5173). Запросы к API идут с `credentials: 'include'`.

Рейтинг клуба глобальный: очки считаются по всем опубликованным партиям без сезонного разреза.

## Docker

`docker-compose.yml` поднимает три сервиса:

- `nox-db` — Postgres 16, том `nox-app_nox_pg_data` (создаётся сам, если его нет), порт 5432 только на `127.0.0.1`;
- `nox-api` — собирается из `server/`, при старте применяет миграции (`prisma migrate deploy`) и запускает API;
- `nox-proxy` — nginx на [http://localhost:8081](http://localhost:8081): отдаёт собранный клиент из `proxy/html`, проксирует `/api` и `/ws`.

Параметры берутся из корневого `.env` (шаблон — `.env.example`): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SESSION_SECRET`. `server/.env` необязателен.

```bash
cp .env.example .env   # и поменять пароли
cd client && npm install && npm run build && cd ..   # клиент собирается в proxy/html
docker compose up --build
```
