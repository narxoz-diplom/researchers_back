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
| `ENROLLMENT_INVALID_STATUS` | Action not allowed in the enrollment's current status (e.g. cancel after approval) |
| `MATERIAL_PREVIEW_UNSUPPORTED` | `/materials/:id/html` for a non-DOCX file |

## Endpoints

### Health
- `GET /health` — public

### Auth
- `POST /auth/register` — public (outside production without SMTP the response also carries `devVerifyUrl`, the confirmation link, for local testing)
- `POST /auth/login` — public
- `POST /auth/refresh` — public
- `POST /auth/logout` — JWT
- `GET /auth/me` — JWT

### Admin diagnostics
- `POST /admin/mail/test` — ADMIN: sends a test mail to the admin's own address; 503 `MAIL_NOT_CONFIGURED` without SMTP, 502 `MAIL_DELIVERY_FAILED` (+ `detail`) when the SMTP server refuses
- `GET /health` also reports `checks.mail` = `ok` | `not_configured`

### Users
- `GET /users/me` — JWT
- `PATCH /users/me` — JWT
- `PATCH /users/me/password` — JWT
- `GET /users` — ADMIN
- `GET /users/:id` — ADMIN
- `POST /users` — ADMIN (create a verified account with any role, incl. another ADMIN; password is emailed)
- `PATCH /users/:id/verify-email` — ADMIN (confirm the email by hand when the link never arrived)
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
- `GET /lessons/:id` — JWT + approved enrollment (author/admin bypass). Students get per-viewer `streamUrl` / `viewUrl` links instead of origin URLs
- `PATCH /lessons/:id` — owner / ADMIN
- `DELETE /lessons/:id` — owner / ADMIN
- `POST /lessons/:id/videos` — owner / ADMIN
- `PATCH /videos/:id` — owner / ADMIN
- `DELETE /videos/:id` — owner / ADMIN
- `GET /videos/:id/stream?t=<media token>` — streams an uploaded video to a viewer with access (HTTP ranges; bearer or media token)
- `POST /lessons/:id/materials` — owner / ADMIN
- `GET /materials/:id/view` — inline file for a viewer with access (no download)
- `GET /materials/:id/html` — DOCX rendered as HTML for a viewer with access
- `GET /materials/:id/download` — owner / ADMIN only
- `DELETE /materials/:id` — owner / ADMIN

Lesson files under `uploads/courses/<id>/lessons/` are **not** served by the public `/media/files/` route; YouTube videos are exposed to students only as `youtubeVideoId` (embedded in a sandboxed player).

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

### Course enrollments (per-course purchase)
- `POST /courses/:courseId/enrollments/request` — SUBSCRIBER
- `POST /courses/:courseId/enrollments/purchase` — SUBSCRIBER (Kaspi QR amount; PENDING/UNDERPAID/REJECTED/CANCELLED → PAID)
- `POST /courses/:courseId/enrollments/cancel` — SUBSCRIBER (PENDING/PAID/UNDERPAID → CANCELLED; a later purchase starts from the full price)
- `GET /courses/:courseId/enrollments` — owner / ADMIN
- `POST /courses/:courseId/enrollments/:id/approve|reject|request-more` — owner / ADMIN
- `POST /courses/:courseId/enrollments/:id/adjust-amount` — owner / ADMIN: record the amount that actually arrived (`receivedAmountCents`, optional `note`); PAID/UNDERPAID only, journaled as AMOUNT_ADJUSTED
- `GET /admin/enrollments?status=&search=&courseId=&authorId=&dateFrom=&dateTo=&page=&pageSize=` — ADMIN journal: every enrollment with its event history (`events[]`: REQUESTED, PAYMENT_SUBMITTED, MORE_PAYMENT_REQUESTED, APPROVED, REJECTED, CANCELLED), newest activity first
- `GET /admin/enrollments/stats?authorId=&dateFrom=&dateTo=&search=` — ADMIN: counts per status, revenue of sold (APPROVED) courses, sum awaiting review (same filters as the list)
- `GET /admin/enrollments/payments` — ADMIN (PAID queue, kept for compatibility)
- `GET /me/enrollments` — SUBSCRIBER

### Landing sections
- `GET /landing-sections` — public
- `PATCH /landing-sections/:slug` — ADMIN only (site copy, not course content)

### Progress
- `POST /lessons/:id/complete` — JWT + subscription
- `DELETE /lessons/:id/complete` — JWT
- `GET /me/progress` — JWT
- `GET /me/progress?courseId=...` — JWT

## Swagger

Interactive docs: [http://localhost:8080/docs](http://localhost:8080/docs)
