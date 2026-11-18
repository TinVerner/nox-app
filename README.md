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

Сезон «Осень 2026», если сезонов ещё нет, создаётся при первом `GET /api/seasons` и скриптом `node ensure-season.js` из `server/`.

## Docker

`docker-compose.yml` собирает `web` (5173), `api` (3000) и `db` (Postgres 16, порт 5432, том `nox_pg_data`). API читает `server/.env`. Параметры Postgres для сервиса `db` берутся из корневого `.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

```bash
docker compose up --build
```

Схема Prisma и опубликованные порты этим файлом не переопределяются.
