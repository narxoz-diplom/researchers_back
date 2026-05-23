import { SubscriptionStatus } from '@prisma/client';
import { SubscriptionDto } from './dto/subscription-response.dto';
import { SubscriptionWithRelations } from './subscriptions.repository.interface';

export function toSubscriptionDto(
  subscription: SubscriptionWithRelations,
  now = new Date(),
): SubscriptionDto {
  return {
    id: subscription.id,
    user: subscription.user,
    plan: subscription.plan,
    status: subscription.status,
    startsAt: subscription.startsAt.toISOString(),
    expiresAt: subscription.expiresAt.toISOString(),
    grantedBy: subscription.grantedBy,
    isActive:
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiresAt > now,
  };
}
