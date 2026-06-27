import { ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  CHAT_MESSAGE_LIMIT_BASIC,
  CHAT_MESSAGE_LIMIT_PRO,
} from './ai.constants';

export interface ChatQuotaSnapshot {
  remaining: number;
  limit: number;
}

@Injectable()
export class LessonChatQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async assertCanChat(userId: string): Promise<ChatQuotaSnapshot> {
    const limit = await this.resolveLimit(userId);
    const periodStart = startOfUtcMonth(new Date());

    const usage = await this.prisma.lessonChatUsage.findUnique({
      where: { userId_periodStart: { userId, periodStart } },
      select: { messageCount: true },
    });

    const used = usage?.messageCount ?? 0;
    if (used >= limit) {
      throw new ForbiddenException(ErrorCode.CHAT_LIMIT_EXCEEDED);
    }

    return { remaining: limit - used, limit };
  }

  async recordUsage(userId: string, tokens: number): Promise<void> {
    const limit = await this.resolveLimit(userId);
    const periodStart = startOfUtcMonth(new Date());
    const tokenDelta = Math.max(0, Math.trunc(tokens));

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.lessonChatUsage.findUnique({
        where: { userId_periodStart: { userId, periodStart } },
      });

      if (!existing) {
        await tx.lessonChatUsage.create({
          data: {
            userId,
            periodStart,
            messageCount: 1,
            tokenCount: tokenDelta,
          },
        });
        return;
      }

      if (existing.messageCount >= limit) {
        throw new ForbiddenException(ErrorCode.CHAT_LIMIT_EXCEEDED);
      }

      await tx.lessonChatUsage.update({
        where: { id: existing.id },
        data: {
          messageCount: { increment: 1 },
          tokenCount: { increment: tokenDelta },
        },
      });
    });
  }

  private async resolveLimit(userId: string): Promise<number> {
    const subscription = await this.subscriptionsService.getMyActive(userId);
    if (subscription?.plan === SubscriptionPlan.PRO) {
      return CHAT_MESSAGE_LIMIT_PRO;
    }
    return CHAT_MESSAGE_LIMIT_BASIC;
  }
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
