# 05. Courses Module

## Цель
CRUD курсов: создание автором, публикация, поиск в каталоге, удаление.

## Endpoints

| Метод | Путь                             | Описание                                                              | Доступ                  |
|-------|----------------------------------|-----------------------------------------------------------------------|-------------------------|
| GET   | `/api/v1/courses`                | Каталог `PUBLISHED` курсов (поиск, пагинация)                          | JWT                     |
| GET   | `/api/v1/courses/:id`            | Детали курса (с уроками — без приватного контента, если нет подписки) | JWT                     |
| POST  | `/api/v1/courses`                | Создать курс (статус `DRAFT`)                                          | AUTHOR / ADMIN          |
| PATCH | `/api/v1/courses/:id`            | Обновить курс                                                          | Owner / ADMIN           |
| POST  | `/api/v1/courses/:id/publish`    | Перевести в `PUBLISHED`                                                | Owner / ADMIN           |
| POST  | `/api/v1/courses/:id/archive`    | Перевести в `ARCHIVED`                                                 | Owner / ADMIN           |
| DELETE| `/api/v1/courses/:id`            | Удалить                                                                | Owner / ADMIN           |
| GET   | `/api/v1/courses/mine`           | Свои курсы автора (все статусы)                                        | AUTHOR / ADMIN          |

## DTO

```ts
class CreateCourseDto {
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(5000) description: string;
  @IsUrl() @IsOptional() coverUrl?: string;  // public_id+secure_url ставит MediaModule
}

class UpdateCourseDto extends PartialType(CreateCourseDto) {}

class CourseListItemDto {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  status: CourseStatus;
  author: { id: string; fullName: string };
  lessonsCount: number;
  createdAt: string;
}

class CourseDetailDto extends CourseListItemDto {
  lessons: LessonSummaryDto[]; // без содержимого видео/файлов, если нет подписки
  hasAccess: boolean;          // true если ADMIN, автор курса или активная подписка
}
```

## Архитектурный слой

```
CoursesController -> CoursesService -> CoursesRepository (Prisma)
                                  \-> MediaService (при удалении: удалить ассеты)
```

Интерфейсы:

```ts
interface ICoursesRepository {
  findById(id: string): Promise<Course | null>;
  findPublished(params: SearchParams): Promise<{ data: Course[]; total: number }>;
  findMine(authorId: string): Promise<Course[]>;
  create(input: CreateCoursePayload): Promise<Course>;
  update(id: string, input: UpdateCoursePayload): Promise<Course>;
  delete(id: string): Promise<void>;
}
```

`CoursesService` инжектит интерфейс через DI-токен `COURSES_REPOSITORY` — это нужно, чтобы сервис не зависел от Prisma напрямую (Clean Architecture).

## Правила доступа
- Каталог отдаёт **только** `PUBLISHED`.
- Детали курса:
  - `ADMIN` и автор видят всё (включая `DRAFT/ARCHIVED`).
  - `SUBSCRIBER` видит только опубликованные курсы; поле `hasAccess` зависит от подписки.
- Список уроков всегда виден (title + orderNumber), а **контент урока, видео и файлы** скрыты, если `hasAccess=false`.

## Definition of Done
- [ ] CRUD работает для автора своих курсов.
- [ ] Только `PUBLISHED` курсы видны подписчику в каталоге.
- [ ] При удалении курса каскадом удаляются уроки/видео/файлы (БД) и ассеты в Cloudinary.
- [ ] Swagger описывает все DTO и коды ответов (200/201/400/401/403/404).
