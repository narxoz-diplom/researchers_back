import { BadRequestException, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AiKeyCryptoService } from './ai-key-crypto.service';
import type { AuthorAiSettingsView } from './author-ai-settings.service';

const PLATFORM_ROW_ID = 'default';

@Injectable()
export class PlatformAiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AiKeyCryptoService,
  ) {}

  async getSubscriberChatSettings(): Promise<AuthorAiSettingsView> {
    const row = await this.prisma.platformAiSettings.findUnique({
      where: { id: PLATFORM_ROW_ID },
      select: { subscriberChatEncryptedKey: true, subscriberChatKeyHint: true },
    });

    if (!row?.subscriberChatEncryptedKey) {
      return { hasApiKey: false };
    }

    return {
      hasApiKey: true,
      keyHint: row.subscriberChatKeyHint ?? undefined,
    };
  }

  async upsertSubscriberChatKey(apiKey: string): Promise<AuthorAiSettingsView> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new BadRequestException(ErrorCode.SUBSCRIBER_CHAT_AI_KEY_REQUIRED);
    }

    const encryptedApiKey = this.crypto.encrypt(trimmed);
    const keyHint = this.crypto.buildKeyHint(trimmed);

    await this.prisma.platformAiSettings.upsert({
      where: { id: PLATFORM_ROW_ID },
      create: {
        id: PLATFORM_ROW_ID,
        subscriberChatEncryptedKey: encryptedApiKey,
        subscriberChatKeyHint: keyHint,
      },
      update: {
        subscriberChatEncryptedKey: encryptedApiKey,
        subscriberChatKeyHint: keyHint,
      },
    });

    return { hasApiKey: true, keyHint };
  }

  async deleteSubscriberChatKey(): Promise<AuthorAiSettingsView> {
    await this.prisma.platformAiSettings.updateMany({
      where: { id: PLATFORM_ROW_ID },
      data: {
        subscriberChatEncryptedKey: null,
        subscriberChatKeyHint: null,
      },
    });
    return { hasApiKey: false };
  }

  async getDecryptedSubscriberChatKey(): Promise<string | null> {
    const row = await this.prisma.platformAiSettings.findUnique({
      where: { id: PLATFORM_ROW_ID },
      select: { subscriberChatEncryptedKey: true },
    });

    if (!row?.subscriberChatEncryptedKey) {
      return null;
    }

    return this.crypto.decrypt(row.subscriberChatEncryptedKey);
  }
}
