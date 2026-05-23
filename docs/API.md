# researchers API v1

Base URL: `http://localhost:8080/api/v1`

Auth header: `Authorization: Bearer <accessToken>`

## Response formats

**Paged lists:** `{ "data": T[], "meta": { "total", "page", "pageSize" } }`

**Errors:**

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "SUBSCRIPTION_REQUIRED",
  "path": "/api/v1/lessons/abc",
  "timestamp": "2026-05-23T11:00:00.000Z"
}
```

### Error codes (`message`)

| Code | When |
|------|------|
| `INVALID_CREDENTIALS` | Wrong email/password |
| `EMAIL_TAKEN` | Register with existing email |
| `SUBSCRIPTION_REQUIRED` | Lesson content without active subscription |
| `OWNERSHIP_REQUIRED` | Edit resource you do not own |
| `LAST_ADMIN_PROTECTED` | Downgrade/delete last admin |
| `LESSON_ORDER_CONFLICT` | Duplicate `orderNumber` in course |
| `UPLOAD_LIMIT_EXCEEDED` | Video/material over size limit |
| `FORBIDDEN_ROLE` | Endpoint requires higher role |

## Endpoints

### Health
- `GET /health` — public

### Auth
- `POST /auth/register` — public
- `POST /auth/login` — public
- `POST /auth/refresh` — public
- `POST /auth/logout` — JWT
- `GET /auth/me` — JWT

### Users
- `GET /users/me` — JWT
- `PATCH /users/me` — JWT
- `PATCH /users/me/password` — JWT
- `GET /users` — ADMIN
- `GET /users/:id` — ADMIN
- `PATCH /users/:id/role` — ADMIN
- `DELETE /users/:id` — ADMIN

### Courses
- `GET /courses` — JWT (published catalog)
- `GET /courses/mine` — AUTHOR, ADMIN
- `GET /courses/:id` — JWT
- `POST /courses` — AUTHOR, ADMIN
- `PATCH /courses/:id` — owner / ADMIN
- `POST /courses/:id/publish` — owner / ADMIN
- `POST /courses/:id/archive` — owner / ADMIN
- `DELETE /courses/:id` — owner / ADMIN

### Lessons
- `GET /courses/:courseId/lessons` — JWT
- `POST /courses/:courseId/lessons` — owner / ADMIN
- `PATCH /courses/:courseId/lessons/reorder` — owner / ADMIN
- `GET /lessons/:id` — JWT + subscription (author/admin bypass)
- `PATCH /lessons/:id` — owner / ADMIN
- `DELETE /lessons/:id` — owner / ADMIN
- `POST /lessons/:id/videos` — owner / ADMIN
- `PATCH /videos/:id` — owner / ADMIN
- `DELETE /videos/:id` — owner / ADMIN
- `POST /lessons/:id/materials` — owner / ADMIN
- `DELETE /materials/:id` — owner / ADMIN

### Media
- `POST /media/sign` — AUTHOR, ADMIN
- `POST /media/sign/avatar` — JWT

### Subscriptions
- `GET /me/subscription` — JWT
- `GET /me/subscriptions` — JWT
- `GET /admin/subscriptions` — ADMIN
- `POST /admin/subscriptions/grant` — ADMIN
- `POST /admin/subscriptions/:id/revoke` — ADMIN
- `POST /admin/subscriptions/:id/extend` — ADMIN

### Progress
- `POST /lessons/:id/complete` — JWT + subscription
- `DELETE /lessons/:id/complete` — JWT
- `GET /me/progress` — JWT
- `GET /me/progress?courseId=...` — JWT

## Swagger

Interactive docs: [http://localhost:8080/docs](http://localhost:8080/docs)
