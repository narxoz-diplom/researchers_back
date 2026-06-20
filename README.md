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

Заполните `JWT_*`, при необходимости `CLOUDINARY_*`, `TELEGRAM_*` и `SEED_ADMIN_*`.

### Telegram: уведомления о заявках на курсы

1. Создайте бота в [@BotFather](https://t.me/BotFather) → скопируйте **токен** в `TELEGRAM_BOT_TOKEN`.
2. **Обязательно** откройте бота в Telegram и нажмите **Start** (или отправьте `/start`). Без этого API вернёт `chat not found`.
3. Узнайте **chat id**:
   - личный чат: откройте `https://api.telegram.org/bot<TOKEN>/getUpdates` и найдите `"chat":{"id":123456789`
   - группа: добавьте бота в группу, отправьте сообщение, снова `getUpdates` — id группы (отрицательное число)
4. Добавьте в `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_CHAT_ID=123456789
   ```

При каждой новой (и повторной) заявке `POST /courses/:id/enrollments/request` и при демо-оплате `POST .../purchase` бот отправит email, название курса и дату.

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

## Полный запуск в Docker (локально)

```bash
cp .env.example .env
# задайте JWT_ACCESS_SECRET и JWT_REFRESH_SECRET

docker compose up --build

# при необходимости создать демо-данные:
docker compose run --rm api npm run seed
```

Поднимаются PostgreSQL и API; миграции применяются автоматически.
Seed запускается отдельной командой — намеренно не на каждом старте.

## Production-деплой на VPS

Полный гайд: [`deploy/README.md`](deploy/README.md).

Кратко:
- Production-стек: [`docker-compose.prod.yml`](docker-compose.prod.yml) +
  [`deploy/nginx/`](deploy/nginx/) + [`deploy/backup/`](deploy/backup/).
- Один-VPS архитектура: edge nginx + TLS (Let's Encrypt), API, web, Postgres,
  encrypted PostgreSQL backups (`pg_dump | zstd | age`).
- Автодеплой: [`/.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
  собирает образ, публикует в GHCR и катит на VPS по SSH.
- Резервные копии: ежедневный шифрованный дамп выгружается в GitHub Actions
  artifacts через [`/.github/workflows/backup.yml`](.github/workflows/backup.yml).

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
