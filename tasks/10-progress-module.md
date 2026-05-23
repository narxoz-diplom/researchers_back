# 10. Progress Module

## Цель
Отслеживать, какие уроки пользователь отметил как пройденные.

## Endpoints

| Метод | Путь                                       | Описание                                | Доступ |
|-------|--------------------------------------------|-----------------------------------------|--------|
| POST  | `/api/v1/lessons/:id/complete`             | Отметить урок пройденным                | JWT + Subscription |
| DELETE| `/api/v1/lessons/:id/complete`             | Снять отметку                            | JWT    |
| GET   | `/api/v1/me/progress?courseId=...`         | Прогресс пользователя по курсу          | JWT    |
| GET   | `/api/v1/me/progress`                      | Общий прогресс (по курсам)              | JWT    |

## DTO

```ts
class CourseProgressDto {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentage: number;          // 0–100, округление вниз
  lastCompletedAt?: string;
}

class LessonProgressDto {
  lessonId: string;
  completedAt: string;
}
```

## Бизнес-правила
- Отметить можно **только тот урок**, к которому есть доступ (`SubscriptionGuard`).
- Повторное `complete` идемпотентно (UPSERT по `(userId, lessonId)`).
- При удалении урока запись `Progress` удаляется каскадом (см. `02-database-schema.md`).
- `GET /me/progress` агрегирует по курсам через один SQL/Prisma-запрос (group by `Lesson.courseId`).

## Definition of Done
- [ ] Можно отметить и снять отметку с урока.
- [ ] Процент считается корректно при разном количестве уроков в курсе.
- [ ] Список «продолжить смотреть» на фронте может работать на основе `lastCompletedAt`.
