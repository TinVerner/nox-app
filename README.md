# NOX — каркас приложения (шаг 2)

Постепенный greenfield для курсовой СТСР. Старый код в `Приложение\` не трогаем.

## Что здесь лежит

| Путь | Назначение |
|------|------------|
| `client/` | Фронтенд (позже Vite + React). Пока пусто. |
| `server/` | Бэкенд Express: hello-маршрут `/api/health`. |
| `docker-compose.yml` | Описание трёх сервисов: `web`, `api`, `db`. Пока скелет с комментариями. |
| `.env.example` | Шаблон переменных Postgres. Скопируйте в `.env` перед работой с БД. |
| `.gitignore` | Исключает `node_modules`, `.env`, сборки и т.п. |

## Запуск API локально (шаг 2)

```bash
cd server
npm install
npm run dev
```

Открой в браузере или curl: [http://localhost:3000/api/health](http://localhost:3000/api/health)  
Ожидаемый JSON: `{ "ok": true, "message": "NOX API hello" }`.

- `npm run dev` — перезапуск при правках (`node --watch`).
- `npm start` — обычный запуск без watch.
- Порт: `3000` или переменная `PORT`.

## Как сюда войдёт Docker позже

1. Появятся `Dockerfile` в `client/` и `server/`.
2. В `docker-compose.yml` раскомментируют `build` / `depends_on`.
3. Команда `docker compose up` поднимет фронт (5173), API (3000) и Postgres (5432).

Сервис `db` уже описан на образе `postgres:16-alpine`. Полный стек пока рано — нет фронта и Prisma.

## Статус

**Шаг 2 выполнен:** минимальный Express hello в `server/`. Vite/Prisma ещё нет.
