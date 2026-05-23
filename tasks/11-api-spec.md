# 11. API Spec & Swagger

## Цель
Собрать единый список всех публичных endpoint'ов и обеспечить актуальную Swagger-документацию.

## Глобальные правила

- Все ответы — JSON, кодировка UTF-8.
- Базовый префикс — `/api/v1`.
- Авторизация — `Authorization: Bearer <accessToken>`.
- Списки возвращаются как `{ data: T[], meta: { total, page, pageSize } }`.
- Ошибки — единый формат через `GlobalExceptionFilter`:
  ```json
  {
    "statusCode": 403,
    "error": "Forbidden",
    "message": "SUBSCRIPTION_REQUIRED",
    "path": "/api/v1/lessons/abc",
    "timestamp": "2026-05-23T11:00:00.000Z"
  }
  ```
- Машиночитаемые коды ошибок (в `message`):
  - `INVALID_CREDENTIALS`
  - `EMAIL_TAKEN`
  - `SUBSCRIPTION_REQUIRED`
  - `OWNERSHIP_REQUIRED`
  - `LAST_ADMIN_PROTECTED`
  - `LESSON_ORDER_CONFLICT`
  - `UPLOAD_LIMIT_EXCEEDED`

## Сводный список endpoint'ов

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET  /auth/me`

### Users
- `GET    /users/me`
- `PATCH  /users/me`
- `PATCH  /users/me/password`
- `GET    /users`            *(ADMIN)*
- `GET    /users/:id`        *(ADMIN)*
- `PATCH  /users/:id/role`   *(ADMIN)*
- `DELETE /users/:id`        *(ADMIN)*

### Courses
- `GET    /courses`
- `GET    /courses/mine`
- `GET    /courses/:id`
- `POST   /courses`
- `PATCH  /courses/:id`
- `POST   /courses/:id/publish`
- `POST   /courses/:id/archive`
- `DELETE /courses/:id`

### Lessons
- `GET    /courses/:courseId/lessons`
- `POST   /courses/:courseId/lessons`
- `PATCH  /courses/:courseId/lessons/reorder`
- `GET    /lessons/:id`
- `PATCH  /lessons/:id`
- `DELETE /lessons/:id`

### Videos
- `POST   /lessons/:id/videos`
- `PATCH  /videos/:id`
- `DELETE /videos/:id`

### Materials
- `POST   /lessons/:id/materials`
- `DELETE /materials/:id`

### Media
- `POST   /media/sign`
- `POST   /media/sign/avatar`

### Subscriptions
- `GET    /me/subscription`
- `GET    /me/subscriptions`
- `GET    /admin/subscriptions`        *(ADMIN)*
- `POST   /admin/subscriptions/grant`  *(ADMIN)*
- `POST   /admin/subscriptions/:id/revoke` *(ADMIN)*
- `POST   /admin/subscriptions/:id/extend` *(ADMIN)*

### Progress
- `POST   /lessons/:id/complete`
- `DELETE /lessons/:id/complete`
- `GET    /me/progress`
- `GET    /me/progress?courseId=...`

### Health
- `GET    /health`

## Swagger

- `@nestjs/swagger` подключается в `main.ts`:
  ```ts
  const config = new DocumentBuilder()
    .setTitle('researchers API')
    .setDescription('Course platform without AI generation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  ```
- Все DTO помечены декораторами `@ApiProperty`.
- Контроллеры — `@ApiTags(...)`, `@ApiBearerAuth()`, `@ApiOperation`, `@ApiResponse`.
- Запустить → `http://localhost:8080/docs`.

## Definition of Done
- [ ] Swagger открывается и покрывает 100% эндпоинтов.
- [ ] Машиночитаемые коды ошибок указаны в `@ApiResponse`.
- [ ] Тестовый пробег `curl`-ом по основным сценариям проходит без расхождений с документацией.
