# 01. Project Bootstrap

## Цель
Развернуть скелет NestJS-проекта с предсказуемой структурой, конфигами, линтерами и Prisma.

## Шаги

1. **Инициализация:**
   ```bash
   npm i -g @nestjs/cli
   nest new researchers-api --strict --package-manager npm
   ```
2. **Зависимости:**
   ```bash
   npm i @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt \
         class-validator class-transformer bcrypt \
         @prisma/client cloudinary \
         @nestjs/swagger @nestjs/throttler
   npm i -D prisma @types/bcrypt @types/passport-jwt
   ```
3. **Prisma init:**
   ```bash
   npx prisma init --datasource-provider postgresql
   ```
4. **Структура каталогов:**
   ```
   src/
     main.ts
     app.module.ts
     common/{decorators,guards,filters,pipes,interceptors}
     config/
     modules/{auth,users,courses,lessons,media,subscriptions,progress}
     prisma/
   ```
5. **Глобальные пайплайны и фильтры** в `main.ts`:
   - `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`
   - `app.useGlobalFilters(new GlobalExceptionFilter())`
   - `app.setGlobalPrefix('api/v1')`
   - Подключить Swagger.
6. **ConfigModule** — `forRoot({ isGlobal: true, envFilePath: '.env' })`.
7. **PrismaService** — extends `PrismaClient` с `onModuleInit/onModuleDestroy`.
8. **Линтеры/форматтеры** — `eslint`, `prettier`, `husky` + `lint-staged`.

## Переменные окружения (`.env.example`)
```
NODE_ENV=development
PORT=8080
DATABASE_URL=postgresql://researchers:researchers@localhost:5432/researchers
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me_too
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CORS_ORIGINS=http://localhost:5173
```

## Definition of Done
- [ ] `npm run start:dev` поднимает приложение на `:8080`.
- [ ] `GET /api/v1/health` возвращает `{ status: 'ok' }`.
- [ ] Swagger открывается по `/docs`.
- [ ] `npm run lint` и `npm run format` работают без ошибок.
- [ ] `npx prisma migrate dev --name init` создаёт пустую миграцию.
