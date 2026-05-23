import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { SUBSCRIPTIONS_REPOSITORY } from './subscriptions.constants';
import type { ISubscriptionsRepository } from './subscriptions.repository.interface';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto';
import { ListAdminSubscriptionsQueryDto } from './dto/list-admin-subscriptions-query.dto';
import {
  PagedSubscriptionsDto,
  SubscriptionDto,
} from './dto/subscription-response.dto';
import { toSubscriptionDto } from './subscription.mapper';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: ISubscriptionsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async hasActive(userId: string): Promise<boolean> {
    const sub = await this.subscriptionsRepository.findActiveByUser(userId);
    return (
      !!sub &&
      sub.status === SubscriptionStatus.ACTIVE &&
      sub.expiresAt > new Date()
    );
  }

  async getMyActive(userId: string): Promise<SubscriptionDto | null> {
    const sub = await this.subscriptionsRepository.findActiveByUser(userId);
    return sub ? toSubscriptionDto(sub) : null;
  }

  async getMyHistory(userId: string): Promise<SubscriptionDto[]> {
    const subs = await this.subscriptionsRepository.findByUser(userId);
    return subs.map((s) => toSubscriptionDto(s));
  }

  async listAdmin(
    query: ListAdminSubscriptionsQueryDto,
  ): Promise<PagedSubscriptionsDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { data, total } = await this.subscriptionsRepository.findManyAdmin({
      userId: query.userId,
      status: query.status,
      page,
      pageSize,
    });

    return {
      data: data.map((s) => toSubscriptionDto(s)),
      meta: { total, page, pageSize },
    };
  }

  async grant(
    adminId: string,
    dto: GrantSubscriptionDto,
  ): Promise<SubscriptionDto> {
    const user = await this.usersRepository.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.subscriptionsRepository.revokeActiveByUser(dto.userId);

    const startsAt = new Date();
    const expiresAt = addDays(startsAt, dto.durationDays);

    const created = await this.subscriptionsRepository.create({
      userId: dto.userId,
      plan: dto.plan,
      startsAt,
      expiresAt,
      grantedById: adminId,
    });

    return toSubscriptionDto(created);
  }

  async revoke(id: string): Promise<SubscriptionDto> {
    const sub = await this.findOrThrow(id);
    const now = new Date();
    const updated = await this.subscriptionsRepository.update(id, {
      status: SubscriptionStatus.REVOKED,
      expiresAt: sub.expiresAt < now ? sub.expiresAt : now,
    });
    return toSubscriptionDto(updated);
  }

  async extend(
    id: string,
    dto: ExtendSubscriptionDto,
  ): Promise<SubscriptionDto> {
    const sub = await this.findOrThrow(id);
    const now = new Date();
    const base = sub.expiresAt > now ? sub.expiresAt : now;
    const expiresAt = addDays(base, dto.extraDays);

    const updated = await this.subscriptionsRepository.update(id, {
      status: SubscriptionStatus.ACTIVE,
      expiresAt,
    });

    return toSubscriptionDto(updated);
  }

  async expirePastDue(): Promise<number> {
    return this.subscriptionsRepository.expireActivePastDue(new Date());
  }

  private async findOrThrow(id: string) {
    const sub = await this.subscriptionsRepository.findById(id);
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    return sub;
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
