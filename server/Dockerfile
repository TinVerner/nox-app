FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
# Миграции применяются при каждом старте; без них в пустой БД нет таблиц.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node index.js"]
