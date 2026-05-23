# 03. Auth Module

## Цель
Реализовать аутентификацию пользователей с JWT (access + refresh) и базовые публичные endpoint'ы.

## Структура модуля

```
modules/auth/
  auth.controller.ts
  auth.service.ts
  auth.module.ts
  strategies/
    jwt.strategy.ts
  dto/
    register.dto.ts
    login.dto.ts
    refresh.dto.ts
    auth-response.dto.ts
```

## Endpoints

| Метод | Путь                 | Описание                                       | Доступ   |
|-------|----------------------|------------------------------------------------|----------|
| POST  | `/api/v1/auth/register` | Регистрация (роль `SUBSCRIBER` по умолчанию) | Public   |
| POST  | `/api/v1/auth/login`    | Логин по email+password                       | Public   |
| POST  | `/api/v1/auth/refresh`  | Обновление пары токенов                       | Public   |
| POST  | `/api/v1/auth/logout`   | Отзывает refresh-токен                         | JWT      |
| GET   | `/api/v1/auth/me`       | Профиль текущего пользователя                  | JWT      |

## DTO

```ts
class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @MinLength(2) fullName: string;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; role: Role; avatarUrl?: string };
}
```

## Алгоритм

### Регистрация
1. Проверить, что email не занят (`UsersRepository.findByEmail`).
2. `bcrypt.hash(password, 10)`.
3. Создать `User { role: SUBSCRIBER }`.
4. Сгенерировать `accessToken` и `refreshToken` (JWT с разными секретами).
5. Сохранить хэш refresh-токена в `RefreshToken`.
6. Вернуть `AuthResponseDto`.

### Логин
1. Найти пользователя по email; если нет — `UnauthorizedException`.
2. `bcrypt.compare(password, passwordHash)`.
3. Сгенерировать токены и сохранить refresh.
4. Применить `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.

### Refresh
1. Верифицировать refresh JWT (секрет refresh).
2. Найти `RefreshToken` по `tokenHash` (sha256). Проверить `expiresAt`.
3. Сделать ротацию: удалить старый, выдать новую пару.

### Logout
1. Удалить `RefreshToken` пользователя по `tokenHash` из тела или все по `userId`.

### `JwtStrategy`
- Берёт payload `{ sub, email, role }`.
- В `validate` возвращает `{ id: sub, email, role }` — складывается в `request.user`.

## Декораторы
```ts
@Public()             // помечает endpoint как публичный; JwtAuthGuard игнорирует
@CurrentUser()        // достаёт request.user
```

`JwtAuthGuard` подключается **глобально** в `AppModule`, обходится через `@Public()`.

## Definition of Done
- [ ] Можно зарегистрироваться, залогиниться, обновить токены и разлогиниться.
- [ ] `GET /auth/me` без токена → 401, с токеном → профиль.
- [ ] Refresh-токен инвалидится после logout / ротации.
- [ ] На `/auth/login` действует rate-limit 5 запросов / минута на IP.
- [ ] Все DTO задокументированы в Swagger.
