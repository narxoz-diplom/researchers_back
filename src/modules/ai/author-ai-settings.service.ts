import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AiKeyCryptoService } from './ai-key-crypto.service';

export interface AuthorAiSettingsView {
  hasApiKey: boolean;
  keyHint?: string;
}

@Injectable()
export class AuthorAiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AiKeyCryptoService,
  ) {}

  async getSettings(userId: string): Promise<AuthorAiSettingsView> {
    const row = await this.prisma.authorAiSettings.findUnique({
      where: { userId },
      select: { keyHint: true },
    });

    if (!row) {
      return { hasApiKey: false };
    }

    return {
      hasApiKey: true,
      keyHint: row.keyHint ?? undefined,
    };
  }

  async upsertKey(
    userId: string,
    apiKey: string,
  ): Promise<AuthorAiSettingsView> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new BadRequestException(ErrorCode.AUTHOR_AI_KEY_REQUIRED);
    }

    const encryptedApiKey = this.crypto.encrypt(trimmed);
    const keyHint = this.crypto.buildKeyHint(trimmed);

    await this.prisma.authorAiSettings.upsert({
      where: { userId },
      create: { userId, encryptedApiKey, keyHint },
      update: { encryptedApiKey, keyHint },
    });

    return { hasApiKey: true, keyHint };
  }

  async deleteKey(userId: string): Promise<AuthorAiSettingsView> {
    await this.prisma.authorAiSettings.deleteMany({ where: { userId } });
    return { hasApiKey: false };
  }

  async getDecryptedKey(userId: string): Promise<string | null> {
    const row = await this.prisma.authorAiSettings.findUnique({
      where: { userId },
      select: { encryptedApiKey: true },
    });

    if (!row) {
      return null;
    }

    return this.crypto.decrypt(row.encryptedApiKey);
  }
}
