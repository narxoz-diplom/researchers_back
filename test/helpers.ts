import { INestApplication } from '@nestjs/common';
import { AuthorStatus, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { App } from 'supertest/types';
import { AuthService } from './../src/modules/auth/auth.service';
import { AuthResponseDto } from './../src/modules/auth/dto/auth-response.dto';
import { PrismaService } from './../src/prisma/prisma.service';

interface TokenIssuer {
  issueTokens(user: User): Promise<AuthResponseDto>;
}

export interface TestUserInput {
  email: string;
  password: string;
  fullName: string;
  role: 'SUBSCRIBER' | 'AUTHOR' | 'ADMIN';
  /** Authors only; defaults to APPROVED so course endpoints work. */
  authorStatus?: AuthorStatus;
}

export const VALID_AUTHOR_APPLICATION = {
  legalName: 'Тест Автор Тестұлы',
  iin: '900101400123',
  phone: '+7 701 123 45 67',
  city: 'Алматы',
  acceptOffer: true,
};

/**
 * Creates a user with a verified email (signup sends a confirmation link the
 * tests cannot click) and issues tokens without the rate-limited login route.
 * `body` has the same shape the old self-login signup returned.
 */
export async function registerVerified(
  app: INestApplication<App>,
  input: TestUserInput,
): Promise<{ body: AuthResponseDto }> {
  const prisma = app.get(PrismaService);
  const isAuthor = input.role === Role.AUTHOR;
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 4),
      fullName: input.fullName,
      role: input.role,
      emailVerified: true,
      ...(isAuthor
        ? {
            authorStatus: input.authorStatus ?? AuthorStatus.APPROVED,
            authorApplication: {
              create: {
                legalName: input.fullName,
                iin: VALID_AUTHOR_APPLICATION.iin,
                phone: VALID_AUTHOR_APPLICATION.phone,
                city: VALID_AUTHOR_APPLICATION.city,
                offerVersion: 'test',
                acceptedAt: new Date(),
              },
            },
          }
        : {}),
    },
  });

  // issueTokens is private; tests reach it to skip the rate-limited login route.
  const auth: TokenIssuer = app.get(AuthService);
  return { body: await auth.issueTokens(user) };
}

/** Unique email per call, safe across parallel describe blocks. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

/** Tokens for an existing account (e.g. the seeded admin) without the rate-limited login. */
export async function tokensFor(
  app: INestApplication<App>,
  email: string,
): Promise<AuthResponseDto> {
  const user = await app
    .get(PrismaService)
    .user.findUniqueOrThrow({ where: { email } });
  // issueTokens is private; tests reach it to skip the rate-limited login route.
  const auth: TokenIssuer = app.get(AuthService);
  return auth.issueTokens(user);
}

/** Admin created by `prisma db seed`; tests share it so there stays exactly one admin. */
export const SEED_ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ?? 'admin@researchers.local';
