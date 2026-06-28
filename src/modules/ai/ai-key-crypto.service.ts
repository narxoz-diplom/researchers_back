import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ErrorCode } from '../../common/errors/error-codes';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class AiKeyCryptoService {
  constructor(private readonly configService: ConfigService) {}

  buildKeyHint(apiKey: string): string {
    return apiKey.length <= 4 ? apiKey : apiKey.slice(-4);
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(payload: string): string {
    const key = this.getEncryptionKey();
    const data = Buffer.from(payload, 'base64');

    if (data.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new InternalServerErrorException(ErrorCode.AI_SERVICE_UNAVAILABLE);
    }

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const raw = this.configService.get<string>('AI_ENCRYPTION_KEY')?.trim();
    if (!raw) {
      throw new InternalServerErrorException(ErrorCode.AI_SERVICE_UNAVAILABLE);
    }

    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException(ErrorCode.AI_SERVICE_UNAVAILABLE);
    }

    return key;
  }
}
