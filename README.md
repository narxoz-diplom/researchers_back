# researchers API

Backend учебной платформы **researchers** — курсы с ручным наполнением, подписки без платёжки, медиа через Cloudinary. Без AI/RAG.

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
# PostgreSQL (порт 5432 в docker-compose или 5433 если 5432 занят)
docker compose up -d postgres

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

У автора уже есть два демо-курса (один опубликован, один черновик), у подписчика — активная подписка на 30 дней.

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

`auth` · `users` · `courses` · `lessons` · `media` · `subscriptions` · `progress`

## Коды ошибок API

В поле `message` ответа об ошибке:

`INVALID_CREDENTIALS` · `EMAIL_TAKEN` · `SUBSCRIPTION_REQUIRED` · `OWNERSHIP_REQUIRED` · `LAST_ADMIN_PROTECTED` · `LESSON_ORDER_CONFLICT` · `UPLOAD_LIMIT_EXCEEDED` · `FORBIDDEN_ROLE`
