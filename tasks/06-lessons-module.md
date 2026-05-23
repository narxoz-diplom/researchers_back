# 06. Lessons Module

## Цель
CRUD уроков и прикреплённых к ним видео и файлов.

## Endpoints

### Уроки

| Метод  | Путь                                          | Описание                              | Доступ          |
|--------|-----------------------------------------------|---------------------------------------|-----------------|
| GET    | `/api/v1/courses/:courseId/lessons`           | Список уроков курса                   | JWT             |
| GET    | `/api/v1/lessons/:id`                         | Детали урока (контент + медиа)        | JWT + Subscription / Owner / ADMIN |
| POST   | `/api/v1/courses/:courseId/lessons`           | Создать урок                          | Owner / ADMIN   |
| PATCH  | `/api/v1/lessons/:id`                         | Обновить урок                         | Owner / ADMIN   |
| DELETE | `/api/v1/lessons/:id`                         | Удалить урок (+ медиа)                | Owner / ADMIN   |
| PATCH  | `/api/v1/courses/:courseId/lessons/reorder`   | Массово обновить `orderNumber`        | Owner / ADMIN   |

### Видео

| Метод  | Путь                                          | Описание                              | Доступ          |
|--------|-----------------------------------------------|---------------------------------------|-----------------|
| POST   | `/api/v1/lessons/:id/videos`                  | Прикрепить видео (после Cloudinary)   | Owner / ADMIN   |
| PATCH  | `/api/v1/videos/:id`                          | Изменить title / orderNumber          | Owner / ADMIN   |
| DELETE | `/api/v1/videos/:id`                          | Удалить                               | Owner / ADMIN   |

### Материалы (файлы)

| Метод  | Путь                                          | Описание                              | Доступ          |
|--------|-----------------------------------------------|---------------------------------------|-----------------|
| POST   | `/api/v1/lessons/:id/materials`               | Прикрепить материал                   | Owner / ADMIN   |
| DELETE | `/api/v1/materials/:id`                       | Удалить                               | Owner / ADMIN   |

## DTO

```ts
class CreateLessonDto {
  @IsString() @MaxLength(200) title: string;
  @IsString() @IsOptional() content?: string;     // markdown / plain text
  @IsInt() @Min(1) orderNumber: number;
}

class UpdateLessonDto extends PartialType(CreateLessonDto) {}

class ReorderLessonsDto {
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}
class ReorderItem {
  @IsString() id: string;
  @IsInt() @Min(1) orderNumber: number;
}

class AttachVideoDto {
  @IsString() title: string;
  @IsString() cloudinaryPublicId: string;
  @IsUrl() url: string;
  @IsInt() @Min(0) durationSeconds: number;
  @IsInt() @Min(1) sizeBytes: number;
  @IsInt() @Min(1) @IsOptional() orderNumber?: number;
}

class AttachMaterialDto {
  @IsString() title: string;
  @IsString() cloudinaryPublicId: string;
  @IsUrl() url: string;
  @IsString() mimeType: string;
  @IsInt() @Min(1) sizeBytes: number;
}
```

## Бизнес-правила
- При создании урока `orderNumber` уникален в рамках курса (DB constraint).
- `reorder` атомарно (в транзакции) обновляет порядок.
- При удалении урока сначала удаляются ассеты в Cloudinary (`MediaService.deleteByPublicIds`), затем запись в БД.
- Контент урока, видео и файлы возвращаются **только** при `hasAccess=true` (см. `SubscriptionGuard`).
- Для черновика урок может существовать без видео и файлов.

## Definition of Done
- [ ] CRUD уроков и медиа работает.
- [ ] Reorder валидирует уникальность `orderNumber`.
- [ ] Удаление урока чистит ассеты Cloudinary.
- [ ] Подписчик без подписки получает `403` на содержимое урока, но видит сам список (заголовки/порядок).
