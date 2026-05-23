# 12. Deployment

## Цель
Запускать проект одной командой локально и в dev-окружении.

## `docker-compose.yml`

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15-alpine
    container_name: researchers-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: researchers
      POSTGRES_PASSWORD: researchers
      POSTGRES_DB: researchers
    ports:
      - "5432:5432"
    volumes:
      - researchers_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U researchers"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: .
    container_name: researchers-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 8080
      DATABASE_URL: postgresql://researchers:researchers@postgres:5432/researchers
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_TTL: 15m
      JWT_REFRESH_TTL: 7d
      CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}
      CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY}
      CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173}
      SEED_ADMIN_EMAIL: ${SEED_ADMIN_EMAIL}
      SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD}
    ports:
      - "8080:8080"
    command: sh -c "npx prisma migrate deploy && node dist/main.js"

volumes:
  researchers_pg:
```

## `Dockerfile`

```dockerfile
# build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# runtime
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./
EXPOSE 8080
CMD ["node", "dist/main.js"]
```

## Seed-скрипт

`prisma/seed.ts`:

```ts
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD required');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin already exists');
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      fullName: 'Platform Admin',
      role: Role.ADMIN,
    },
  });
  console.log('Admin seeded:', email);
}

main().finally(() => prisma.$disconnect());
```

В `package.json`:
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

## README (минимум)

Должен содержать:
1. Описание проекта (ссылка на `TZ.md`).
2. Требования: Node 20+, Docker, Cloudinary-аккаунт.
3. `cp .env.example .env` и заполнение секретов.
4. `docker compose up -d postgres` → `npm install` → `npx prisma migrate dev` → `npm run seed` → `npm run start:dev`.
5. Полностью контейнерно: `docker compose up --build`.
6. Swagger: `http://localhost:8080/docs`.

## Definition of Done
- [ ] `docker compose up --build` поднимает БД и API; миграции применяются автоматически.
- [ ] После запуска можно залогиниться seed-админом.
- [ ] Health-check `GET /api/v1/health` возвращает `200`.
- [ ] README покрывает все шаги для нового разработчика.
