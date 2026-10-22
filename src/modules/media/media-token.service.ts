import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/** How long a lesson media link handed to a viewer stays valid. */
export const MEDIA_TOKEN_TTL_SECONDS = 4 * 60 * 60;

export interface MediaTokenClaims {
  userId: string;
  lessonId: string;
}

interface MediaTokenPayload {
  u: string;
  l: string;
  e: number;
}

/**
 * Short-lived, user-bound token that lets a `<video>` tag reach the stream
 * route without an Authorization header. Access itself is re-checked in the
 * database on every request, so revoking an enrollment takes effect at once.
 */
@Injectable()
export class MediaTokenService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const secret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.key = createHmac('sha256', secret).update('lesson-media').digest();
  }

  sign(
    claims: MediaTokenClaims,
    ttlSeconds: number = MEDIA_TOKEN_TTL_SECONDS,
  ): string {
    const payload: MediaTokenPayload = {
      u: claims.userId,
      l: claims.lessonId,
      e: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.signature(encoded)}`;
  }

  verify(token: string): MediaTokenClaims | null {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra !== undefined) {
      return null;
    }

    const expected = Buffer.from(this.signature(encoded));
    const actual = Buffer.from(signature);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }

    let payload: Partial<MediaTokenPayload>;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as Partial<MediaTokenPayload>;
    } catch {
      return null;
    }
    if (
      typeof payload.u !== 'string' ||
      typeof payload.l !== 'string' ||
      typeof payload.e !== 'number' ||
      payload.e <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { userId: payload.u, lessonId: payload.l };
  }

  private signature(encoded: string): string {
    return createHmac('sha256', this.key).update(encoded).digest('base64url');
  }
}
