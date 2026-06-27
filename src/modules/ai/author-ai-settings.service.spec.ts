import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AuthorAiSettingsService } from './author-ai-settings.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('AuthorAiSettingsService', () => {
  const encryptionKey = randomBytes(32).toString('base64');
  let service: AuthorAiSettingsService;
  let stored: {
    userId: string;
    encryptedApiKey: string;
    keyHint: string | null;
  } | null;

  const prisma = {
    authorAiSettings: {
      findUnique: jest.fn(({ where }: { where: { userId: string } }) =>
        stored && stored.userId === where.userId
          ? {
              encryptedApiKey: stored.encryptedApiKey,
              keyHint: stored.keyHint,
            }
          : null,
      ),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { userId: string };
          create: {
            userId: string;
            encryptedApiKey: string;
            keyHint: string | null;
          };
          update: { encryptedApiKey: string; keyHint: string | null };
        }) => {
          if (stored && stored.userId === where.userId) {
            stored = {
              userId: where.userId,
              encryptedApiKey: update.encryptedApiKey,
              keyHint: update.keyHint,
            };
          } else {
            stored = create;
          }
          return stored;
        },
      ),
      deleteMany: jest.fn(() => {
        stored = null;
        return { count: 1 };
      }),
    },
  } as unknown as PrismaService;

  const configService = {
    get: jest.fn((key: string) =>
      key === 'AI_ENCRYPTION_KEY' ? encryptionKey : undefined,
    ),
  } as unknown as ConfigService;

  beforeEach(() => {
    stored = null;
    jest.clearAllMocks();
    service = new AuthorAiSettingsService(prisma, configService);
  });

  it('encrypts and decrypts API key roundtrip', async () => {
    const apiKey = 'AIzaSyTestKey1234567890';

    await service.upsertKey('user-1', apiKey);

    expect(stored?.encryptedApiKey).toBeDefined();
    expect(stored?.encryptedApiKey).not.toContain(apiKey);
    expect(stored?.keyHint).toBe('7890');

    const decrypted = await service.getDecryptedKey('user-1');
    expect(decrypted).toBe(apiKey);
  });

  it('returns hasApiKey false when no settings exist', async () => {
    await expect(service.getSettings('missing-user')).resolves.toEqual({
      hasApiKey: false,
    });
  });

  it('clears stored key on delete', async () => {
    await service.upsertKey('user-1', 'AIzaSyDeleteMe1234');
    await service.deleteKey('user-1');

    await expect(service.getSettings('user-1')).resolves.toEqual({
      hasApiKey: false,
    });
    await expect(service.getDecryptedKey('user-1')).resolves.toBeNull();
  });
});
