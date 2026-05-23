import { Prisma, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export interface GrantSubscriptionPayload {
  userId: string;
  plan: SubscriptionPlan;
  startsAt: Date;
  expiresAt: Date;
  grantedById: string;
}

export interface ListAdminSubscriptionsParams {
  userId?: string;
  status?: SubscriptionStatus;
  page: number;
  pageSize: number;
}

export type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: {
    user: { select: { id: true; email: true; fullName: true } };
    grantedBy: { select: { id: true; fullName: true } };
  };
}>;

export interface ISubscriptionsRepository {
  findActiveByUser(userId: string): Promise<SubscriptionWithRelations | null>;
  findByUser(userId: string): Promise<SubscriptionWithRelations[]>;
  findById(id: string): Promise<SubscriptionWithRelations | null>;
  findManyAdmin(
    params: ListAdminSubscriptionsParams,
  ): Promise<{ data: SubscriptionWithRelations[]; total: number }>;
  revokeActiveByUser(userId: string): Promise<void>;
  create(payload: GrantSubscriptionPayload): Promise<SubscriptionWithRelations>;
  update(
    id: string,
    data: Prisma.SubscriptionUpdateInput,
  ): Promise<SubscriptionWithRelations>;
  expireActivePastDue(now: Date): Promise<number>;
}
