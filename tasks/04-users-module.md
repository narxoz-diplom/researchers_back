# 04. Users Module

## Цель
Управлять профилем пользователя и (для админа) ролями.

## Endpoints

| Метод | Путь                        | Описание                       | Доступ        |
|-------|-----------------------------|--------------------------------|---------------|
| GET   | `/api/v1/users/me`          | Профиль текущего пользователя  | JWT           |
| PATCH | `/api/v1/users/me`          | Изменить ФИО / аватар          | JWT           |
| PATCH | `/api/v1/users/me/password` | Сменить пароль                 | JWT           |
| GET   | `/api/v1/users`             | Список пользователей (фильтр по role, поиск по email/имени, пагинация) | ADMIN |
| GET   | `/api/v1/users/:id`         | Детали пользователя            | ADMIN         |
| PATCH | `/api/v1/users/:id/role`    | Сменить роль                   | ADMIN         |
| DELETE| `/api/v1/users/:id`         | Удалить пользователя           | ADMIN         |

## DTO

```ts
class UpdateProfileDto {
  @IsString() @MinLength(2) @IsOptional() fullName?: string;
  @IsUrl() @IsOptional() avatarUrl?: string;       // приходит после загрузки в Cloudinary
}

class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

class ChangeRoleDto {
  @IsEnum(Role) role: Role;
}

class UserResponseDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
}

class PagedUsersDto {
  data: UserResponseDto[];
  meta: { total: number; page: number; pageSize: number };
}
```

## Бизнес-правила

- Аватар грузится фронтом в Cloudinary через подписанный upload (см. `07-media-cloudinary.md`), бэк сохраняет `secure_url`.
- Сменить пароль можно только при правильном текущем (`bcrypt.compare`).
- При смене роли админом — запретить даунгрейд последнего админа в системе (защита от блокировки).
- При удалении пользователя:
  - Если у него есть курсы и роль `AUTHOR`/`ADMIN` — запрос отклоняется до переноса или удаления курсов (`409 Conflict`), либо реализуется soft-delete (тогда `Course.author` нельзя оставлять «висящим»). Для MVP — `409`.

## Definition of Done
- [ ] Профиль читается и обновляется.
- [ ] Сменить пароль можно только при корректном `currentPassword`.
- [ ] Админ видит список с пагинацией и фильтрами.
- [ ] Нельзя удалить/даунгрейдить последнего админа.
- [ ] Изменения отражаются в JWT только после нового логина (документировано в Swagger).
