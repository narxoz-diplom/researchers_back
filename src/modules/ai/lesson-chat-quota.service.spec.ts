import { ForbiddenException } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { ErrorCode } from '../../common/errors/error-codes';
import { LessonChatQuotaService } from './lesson-chat-quota.service';
import { CHAT_MESSAGE_LIMIT_BASIC } from './ai.constants';

describe('LessonChatQuotaService', () => {
  const prisma = {
    lessonChatUsage: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const subscriptionsService = {
    getMyActive: jest.fn(),
  };

  let service: LessonChatQuotaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LessonChatQuotaService(
      prisma as never,
      subscriptionsService as never,
    );
    subscriptionsService.getMyActive.mockResolvedValue({
      plan: SubscriptionPlan.BASIC,
    });
  });

  it('throws CHAT_LIMIT_EXCEEDED when quota is exhausted', async () => {
    prisma.lessonChatUsage.findUnique.mockResolvedValue({
      messageCount: CHAT_MESSAGE_LIMIT_BASIC,
    });

    await expect(service.assertCanChat('user-1')).rejects.toMatchObject({
      response: { message: ErrorCode.CHAT_LIMIT_EXCEEDED },
    });
    await expect(service.assertCanChat('user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns remaining messages when under limit', async () => {
    prisma.lessonChatUsage.findUnique.mockResolvedValue({
      messageCount: 2,
    });

    await expect(service.assertCanChat('user-1')).resolves.toEqual({
      remaining: CHAT_MESSAGE_LIMIT_BASIC - 2,
      limit: CHAT_MESSAGE_LIMIT_BASIC,
    });
  });
});
