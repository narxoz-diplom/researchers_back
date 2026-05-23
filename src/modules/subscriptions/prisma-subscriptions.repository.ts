import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GrantSubscriptionPayload,
  ISubscriptionsRepository,
  ListAdminSubscriptionsParams,
  SubscriptionWithRelations,
} from './subscriptions.repository.interface';

const includeRelations = {
  user: { select: { id: true, email: true, fullName: true } },
  grantedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.SubscriptionInclude;

@Injectable()
export class PrismaSubscriptionsRepository implements ISubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByUser(userId: string): Promise<SubscriptionWithRelations | null> {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: includeRelations,
      orderBy: { expiresAt: 'desc' },
    });
  }

  findByUser(userId: string): Promise<SubscriptionWithRelations[]> {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<SubscriptionWithRelations | null> {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: includeRelations,
    });
  }

  async findManyAdmin(
    params: ListAdminSubscriptionsParams,
  ): Promise<{ data: SubscriptionWithRelations[]; total: number }> {
    const where: Prisma.SubscriptionWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        include: includeRelations,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return { data, total };
  }

  async revokeActiveByUser(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.subscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.REVOKED,
        expiresAt: now,
      },
    });
  }

  create(
    payload: GrantSubscriptionPayload,
  ): Promise<SubscriptionWithRelations> {
    return this.prisma.subscription.create({
      data: {
        userId: payload.userId,
        plan: payload.plan,
        status: SubscriptionStatus.ACTIVE,
        startsAt: payload.startsAt,
        expiresAt: payload.expiresAt,
        grantedById: payload.grantedById,
      },
      include: includeRelations,
    });
  }

  update(
    id: string,
    data: Prisma.SubscriptionUpdateInput,
  ): Promise<SubscriptionWithRelations> {
    return this.prisma.subscription.update({
      where: { id },
      data,
      include: includeRelations,
    });
  }

  expireActivePastDue(now: Date): Promise<number> {
    return this.prisma.subscription
      .updateMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { lte: now },
        },
        data: { status: SubscriptionStatus.EXPIRED },
      })
      .then((result) => result.count);
  }
}
