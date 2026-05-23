# ТЗ — researchers (Backend)

## 1. Назначение проекта

**researchers** — минималистичная образовательная платформа, в которой авторы вручную создают курсы (тексты уроков + видео + прикреплённые файлы), а пользователи получают доступ к ним **по подписке**. В отличие от предшественника (`academis`), здесь **нет RAG, нет генераций контента, нет ИИ-ассистентов** — только ручное наполнение и распределение доступа.

Бэкенд отвечает за:
- управление пользователями и ролями (`ADMIN`, `AUTHOR`, `SUBSCRIBER`);
- CRUD курсов и уроков (с порядком, статусами, обложками);
- хранение медиа в **Cloudinary** через подписанные загрузки;
- управление **подписками** (выдаёт админ вручную) и контроль доступа к контенту;
- учёт прогресса по урокам;
- единый REST API (JSON, JWT) с документацией Swagger.

## 2. Стек

- **Платформа:** Node.js LTS, TypeScript, [NestJS](https://nestjs.com/) (модульная архитектура).
- **БД:** PostgreSQL 15+.
- **ORM:** Prisma (рекомендуется) — миграции, типобезопасные репозитории.
- **Auth:** Passport JWT (access + refresh), `bcrypt` для паролей.
- **Хранилище медиа:** Cloudinary (изображения и видео; signed uploads).
- **Валидация:** `class-validator` + `class-transformer`, глобальный `ValidationPipe`.
- **Документация API:** `@nestjs/swagger`, доступна по `/docs`.
- **Логирование:** встроенный `Logger` Nest + единый интерсептор ошибок.
- **Тесты:** Jest (unit + e2e на ключевых модулях).
- **Контейнеризация:** Docker + docker-compose (api + postgres).

## 3. Архитектурные принципы

Соблюдаем Clean Architecture + SOLID + DRY:

- **Контроллеры** — только HTTP-маршрутизация и сериализация DTO.
- **Сервисы** — вся бизнес-логика. Не зависят от Prisma напрямую через интерфейсы (DI-инверсия зависимостей).
- **Репозитории** — обёртки над Prisma, реализуют интерфейсы домена.
- **Domain (entities/value-objects)** — независимы от инфраструктуры.
- **DTO** — отдельные для запросов и ответов; никогда не отдаём наружу Prisma-сущности.
- **Guards / Interceptors / Pipes** — кросс-кутинг: auth, roles, subscription, validation.

```
src/
  main.ts
  app.module.ts
  common/
    decorators/   # @Roles(), @CurrentUser(), @Public()
    guards/       # JwtAuthGuard, RolesGuard, SubscriptionGuard, OwnerGuard
    filters/      # GlobalExceptionFilter
    pipes/        # ValidationPipe (глобальный)
    interceptors/ # LoggingInterceptor
  config/         # ConfigModule (env)
  modules/
    auth/
    users/
    courses/
    lessons/
    media/        # Cloudinary
    subscriptions/
    progress/
  prisma/
    schema.prisma
    migrations/
    prisma.service.ts
```

## 4. Роли и сценарии

| Роль         | Возможности                                                                 |
|--------------|------------------------------------------------------------------------------|
| `ADMIN`      | Управляет всеми пользователями, выдаёт/отзывает подписки, удаляет курсы.    |
| `AUTHOR`     | Создаёт и редактирует **свои** курсы, загружает видео и файлы.              |
| `SUBSCRIBER` | Просматривает каталог; смотрит уроки и скачивает материалы, если есть активная подписка. |

Базовые сценарии:

1. **Регистрация** → пользователь получает роль `SUBSCRIBER` по умолчанию.
2. **Админ выдаёт роль `AUTHOR`** конкретному пользователю.
3. **Автор создаёт курс** в статусе `DRAFT`, добавляет уроки, загружает видео/файлы.
4. **Автор публикует курс** (`PUBLISHED`) — курс появляется в каталоге.
5. **Подписчик** видит каталог, открывает страницу курса. Если подписка неактивна — превью + CTA «Требуется подписка».
6. **Админ выдаёт подписку** пользователю на N дней.
7. **Подписчик** проходит уроки и помечает их как просмотренные.

## 5. Главные модели данных

Подробности и Prisma-схема — в [`tasks/02-database-schema.md`](tasks/02-database-schema.md).

```
User (id, email, passwordHash, fullName, role, avatarUrl, createdAt)
Course (id, authorId, title, description, coverUrl, status, createdAt, updatedAt)
Lesson (id, courseId, title, content, orderNumber, createdAt, updatedAt)
LessonVideo (id, lessonId, title, cloudinaryPublicId, url, duration, sizeBytes, orderNumber)
LessonMaterial (id, lessonId, title, cloudinaryPublicId, url, mimeType, sizeBytes)
Subscription (id, userId, status, plan, startsAt, expiresAt, grantedById)
Progress (id, userId, lessonId, completedAt)
```

## 6. Безопасность и доступ

- Все endpoint'ы по умолчанию защищены `JwtAuthGuard`. Публичные явно помечаются `@Public()`.
- `RolesGuard` проверяет роли (`@Roles('ADMIN')`).
- `SubscriptionGuard` проверяет активную подписку у `SUBSCRIBER` при доступе к контенту курса.
- `OwnerGuard` — авторы могут менять только свои курсы.
- Пароли — bcrypt (10+ раундов).
- Access JWT TTL 15 минут, refresh TTL 7 дней; refresh хранится в БД (опционально) для возможности отзыва.
- CORS — белый список origin'ов.
- Rate limit на `/auth/*` (`@nestjs/throttler`).

## 7. Нефункциональные требования

- API отвечает в формате `{ data, meta }` для списков и `{ ... }` (плоский объект) для одиночных ресурсов.
- Все ошибки идут через `GlobalExceptionFilter` в формате `{ statusCode, message, error, timestamp, path }`.
- Все timestamp — ISO 8601 UTC.
- Логи в JSON (production) и pretty (dev).
- Покрытие unit-тестами сервисов ≥ 60%.
- Документация Swagger обязательна и должна совпадать с реальностью.

## 8. План работ (таски)

Декомпозиция — в папке [`tasks/`](tasks/):

1. [`00-overview.md`](tasks/00-overview.md) — общий контекст продукта.
2. [`01-project-bootstrap.md`](tasks/01-project-bootstrap.md) — инициализация Nest-проекта, структура папок, линтеры.
3. [`02-database-schema.md`](tasks/02-database-schema.md) — Prisma-схема и миграции.
4. [`03-auth-module.md`](tasks/03-auth-module.md) — регистрация, логин, JWT.
5. [`04-users-module.md`](tasks/04-users-module.md) — профиль, смена ролей.
6. [`05-courses-module.md`](tasks/05-courses-module.md) — CRUD курсов.
7. [`06-lessons-module.md`](tasks/06-lessons-module.md) — CRUD уроков.
8. [`07-media-cloudinary.md`](tasks/07-media-cloudinary.md) — подписанная загрузка в Cloudinary.
9. [`08-subscriptions-module.md`](tasks/08-subscriptions-module.md) — модель подписок, выдача/отзыв.
10. [`09-access-control.md`](tasks/09-access-control.md) — guards для ролей и подписок.
11. [`10-progress-module.md`](tasks/10-progress-module.md) — отметка просмотренных уроков.
12. [`11-api-spec.md`](tasks/11-api-spec.md) — финальный список endpoint'ов и Swagger.
13. [`12-deployment.md`](tasks/12-deployment.md) — docker-compose, env, README.

## 9. Definition of Done всего проекта

- [ ] Поднимается одной командой `docker compose up`.
- [ ] Есть seed-скрипт, создающий админа.
- [ ] Все 3 роли реализованы и протестированы вручную.
- [ ] Видео и файлы реально грузятся в Cloudinary и стримятся фронту.
- [ ] Подписка может быть выдана/отозвана админом, действует до `expiresAt`.
- [ ] Swagger `/docs` покрывает все endpoint'ы.
- [ ] README объясняет, как запустить проект и переменные окружения.
