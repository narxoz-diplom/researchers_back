# researchers API

Backend учебной платформы **researchers** — курсы с ручным наполнением, заявки на курс и выдача доступа автором, медиа через Cloudinary.

Подробное ТЗ: [`TZ.md`](TZ.md). Список endpoint'ов: [`docs/API.md`](docs/API.md).

## Требования

- Node.js 20+
- Docker & Docker Compose (опционально)
- Аккаунт [Cloudinary](https://cloudinary.com/) для загрузки видео/файлов

## Переменные окружения

```bash
cp .env.example .env
```

Заполните `JWT_*`, при необходимости `CLOUDINARY_*` и `SEED_ADMIN_*`.

## Локальная разработка

```bash
# PostgreSQL на порту 5433 (docker-compose.db.yml)
docker compose -f docker-compose.db.yml up -d

npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run start:dev
```

| URL | Описание |
|-----|----------|
| http://localhost:8080/api/v1 | REST API |
| http://localhost:8080/api/v1/health | Health-check |
| http://localhost:8080/docs | Swagger UI |

### Тестовые аккаунты (создаются командой `npm run seed`)

| Роль | Email | Пароль |
|------|-------|--------|
| `ADMIN` | `admin@researchers.local` | `Admin123!` |
| `AUTHOR` | `author@researchers.local` | `Author123!` |
| `SUBSCRIBER` | `subscriber@researchers.local` | `Subscriber123!` |

У автора есть демо-курсы; у подписчика в seed — одобренная заявка на опубликованный курс.

## Полный запуск в Docker

```bash
cp .env.example .env
# задайте JWT_ACCESS_SECRET и JWT_REFRESH_SECRET

docker compose up --build
```

Поднимаются PostgreSQL и API; миграции и seed выполняются автоматически.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run start:dev` | Dev-сервер |
| `npm run build` | Production build |
| `npm run lint` / `npm run format` | Качество кода |
| `npm run test:e2e` | E2E-тесты |
| `npm run prisma:migrate` | Миграции (dev) |
| `npm run seed` | Создать/обновить админа |

## Модули

`auth` · `users` · `courses` · `lessons` · `media` · `enrollments` · `subscriptions` · `progress`

## Коды ошибок API

В поле `message` ответа об ошибке:

`INVALID_CREDENTIALS` · `EMAIL_TAKEN` · `SUBSCRIPTION_REQUIRED` · `OWNERSHIP_REQUIRED` · `LAST_ADMIN_PROTECTED` · `LESSON_ORDER_CONFLICT` · `UPLOAD_LIMIT_EXCEEDED` · `FORBIDDEN_ROLE`
