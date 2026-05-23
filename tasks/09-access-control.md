# 09. Access Control (Guards & Decorators)

## Цель
Собрать единый, читаемый слой проверки прав: роли + подписка + владение ресурсом.

## Декораторы

```ts
// common/decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// common/decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator<keyof AuthUser | undefined>(
  (key, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    return key ? req.user[key] : req.user;
  },
);
```

## Guards

### `JwtAuthGuard` (глобальный)
```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }
}
```

### `RolesGuard`
```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return required.includes(user.role);
  }
}
```

### `SubscriptionGuard`
Подключается на endpoint'ы доступа к контенту урока.
```ts
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private subscriptions: SubscriptionsService,
    private lessons: LessonsRepository,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    if (user.role === 'ADMIN') return true;

    const lessonId = req.params.id ?? req.params.lessonId;
    const lesson = await this.lessons.findByIdWithCourse(lessonId);
    if (!lesson) throw new NotFoundException();

    // Автор курса всегда видит свой контент
    if (lesson.course.authorId === user.id) return true;

    const active = await this.subscriptions.hasActive(user.id);
    if (!active) throw new ForbiddenException('SUBSCRIPTION_REQUIRED');
    return true;
  }
}
```

### `OwnerGuard` (для курсов и уроков)
Проверяет, что текущий пользователь — автор курса (или `ADMIN`). Реализуется через мета-токен, указывающий, как достать `courseId` из request.

```ts
@Injectable()
export class CourseOwnerGuard implements CanActivate {
  constructor(private courses: CoursesRepository) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    if (user.role === 'ADMIN') return true;

    const courseId =
      req.params.courseId ??
      req.params.id ??
      (req.body?.courseId as string | undefined);
    const course = await this.courses.findById(courseId);
    if (!course) throw new NotFoundException();
    if (course.authorId !== user.id) throw new ForbiddenException();
    return true;
  }
}
```

## Подключение

`AppModule`:
```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
]
```

`SubscriptionGuard` и `CourseOwnerGuard` подключаются **точечно** на нужных эндпоинтах через `@UseGuards(...)`.

## Карта эндпоинтов и охраны

| Группа                    | Guards                                                   |
|---------------------------|----------------------------------------------------------|
| `auth/*`                  | `@Public` где нужно                                      |
| `users/me*`               | только `JwtAuthGuard`                                    |
| `users` (admin)           | `JwtAuthGuard` + `RolesGuard(ADMIN)`                     |
| `courses` GET             | `JwtAuthGuard`                                           |
| `courses` POST/PATCH/DEL  | `JwtAuthGuard` + `RolesGuard(AUTHOR,ADMIN)` + `CourseOwnerGuard` |
| `lessons/:id` GET (content) | `JwtAuthGuard` + `SubscriptionGuard`                   |
| `lessons` mutate          | `JwtAuthGuard` + `RolesGuard(AUTHOR,ADMIN)` + `CourseOwnerGuard` |
| `media/sign`              | `JwtAuthGuard` + `RolesGuard(AUTHOR,ADMIN)`              |
| `admin/subscriptions/*`   | `JwtAuthGuard` + `RolesGuard(ADMIN)`                     |
| `me/subscription*`        | `JwtAuthGuard`                                           |

## Definition of Done
- [ ] Подписчик без активной подписки получает `403 SUBSCRIPTION_REQUIRED` на контент урока.
- [ ] Автор не может редактировать чужой курс (`403`).
- [ ] `ADMIN` обходит все ограничения.
- [ ] `@Public()` работает для `/auth/register`, `/auth/login`, `/auth/refresh`, `/health`.
