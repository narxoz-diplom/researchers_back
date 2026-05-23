# 08. Subscriptions Module

## Цель
Реализовать **ручную выдачу подписок** админом и проверку их активности.

## Endpoints

| Метод | Путь                                                | Описание                                | Доступ |
|-------|-----------------------------------------------------|-----------------------------------------|--------|
| GET   | `/api/v1/me/subscription`                           | Текущая активная подписка (или `null`) | JWT    |
| GET   | `/api/v1/me/subscriptions`                          | История подписок                        | JWT    |
| GET   | `/api/v1/admin/subscriptions`                       | Список всех (фильтр по userId, статусу) | ADMIN  |
| POST  | `/api/v1/admin/subscriptions/grant`                 | Выдать подписку                          | ADMIN  |
| POST  | `/api/v1/admin/subscriptions/:id/revoke`            | Отозвать                                 | ADMIN  |
| POST  | `/api/v1/admin/subscriptions/:id/extend`            | Продлить                                 | ADMIN  |

## DTO

```ts
class GrantSubscriptionDto {
  @IsString() userId: string;
  @IsEnum(SubscriptionPlan) plan: SubscriptionPlan;
  @IsInt() @Min(1) @Max(365) durationDays: number;
}

class ExtendSubscriptionDto {
  @IsInt() @Min(1) @Max(365) extraDays: number;
}

class SubscriptionDto {
  id: string;
  user: { id: string; email: string; fullName: string };
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt: string;
  grantedBy: { id: string; fullName: string };
  isActive: boolean;
}
```

## Бизнес-правила

- **Grant**:
  - Найти пользователя.
  - Если у него уже есть `ACTIVE` подписка → отметить старую как `REVOKED` (или продлить, в зависимости от настройки — для MVP **revoked**).
  - Создать новую `Subscription { startsAt=now, expiresAt=now+durationDays, status=ACTIVE, grantedById=admin.id }`.
- **Revoke**: ставит `status=REVOKED`, `expiresAt=min(expiresAt, now)`.
- **Extend**: продлевает `expiresAt`; если подписка `EXPIRED`, переводит в `ACTIVE`.
- **isActive** в DTO: `status === ACTIVE && expiresAt > now()`.
- Cron-задача (`@nestjs/schedule`, ежедневно в 03:00 UTC) переводит подписки с истёкшим `expiresAt` в `EXPIRED`.

## Helper: `SubscriptionsService.hasActive(userId): Promise<boolean>`

Используется `SubscriptionGuard` (см. `09-access-control.md`):

```ts
async hasActive(userId: string): Promise<boolean> {
  const sub = await this.repo.findActiveByUser(userId);
  return !!sub && sub.status === 'ACTIVE' && sub.expiresAt > new Date();
}
```

## Definition of Done
- [ ] Админ выдаёт подписку из админ-панели — у пользователя сразу появляется доступ.
- [ ] Отзыв подписки сразу убирает доступ (`SubscriptionGuard` пересчитывает).
- [ ] Cron автоматически отмечает истёкшие.
- [ ] `GET /me/subscription` корректно возвращает активную или `null`.
