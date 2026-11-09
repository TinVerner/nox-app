// Express — библиотека для Node.js: удобно описывать HTTP-маршруты и ответы.
import express from "express";
import cors from 'cors'

const app = express();
app.use(cors())
// Порт берём из окружения (Docker/хостинг) или по умолчанию 3000.
const PORT = process.env.PORT || 3000;

// Маршрут GET /api/health — «проверка жизни» API: браузер или curl спрашивают, жив ли сервер.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "NOX API hello" });
});

// listen — запускает сервер и ждёт входящие запросы на указанном порту.
app.listen(PORT, () => {
  console.log(`NOX API listening on http://localhost:${PORT}`);
});
