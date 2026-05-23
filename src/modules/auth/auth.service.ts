import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ErrorCode } from '../../common/errors/error-codes';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UsersRepository } from '../users/users.repository';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

const BCRYPT_ROUNDS = 10;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(ErrorCode.EMAIL_TAKEN);
    }

    if (dto.role !== Role.SUBSCRIBER && dto.role !== Role.AUTHOR) {
      throw new BadRequestException(ErrorCode.FORBIDDEN_ROLE);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      emailVerified: false,
    });

    await this.sendVerificationEmail(user);

    return {
      message: 'CHECK_EMAIL',
      email: user.email,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(ErrorCode.EMAIL_NOT_VERIFIED);
    }

    return this.issueTokens(user);
  }

  async verifyEmail(token: string): Promise<{ message: 'EMAIL_VERIFIED' }> {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await this.prisma.emailVerificationToken.delete({
          where: { id: record.id },
        });
      }
      throw new BadRequestException(ErrorCode.INVALID_VERIFICATION_TOKEN);
    }

    if (record.user.emailVerified) {
      await this.prisma.emailVerificationToken.deleteMany({
        where: { userId: record.userId },
      });
      throw new BadRequestException(ErrorCode.EMAIL_ALREADY_VERIFIED);
    }

    await this.usersRepository.markEmailVerified(record.userId);
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: record.userId },
    });

    return { message: 'EMAIL_VERIFIED' };
  }

  async resendVerification(
    email: string,
  ): Promise<{ message: 'VERIFICATION_SENT' }> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user || user.emailVerified) {
      return { message: 'VERIFICATION_SENT' };
    }

    await this.sendVerificationEmail(user);
    return { message: 'VERIFICATION_SENT' };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    const consumed = await this.prisma.refreshToken.deleteMany({
      where: { tokenHash, userId: payload.sub },
    });

    if (consumed.count === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(ErrorCode.EMAIL_NOT_VERIFIED);
    }

    return this.issueTokens(user);
  }

  async logout(
    currentUser: JwtPayloadUser,
    refreshToken?: string,
  ): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({
        where: { userId: currentUser.id, tokenHash },
      });
      return;
    }

    await this.prisma.refreshToken.deleteMany({
      where: { userId: currentUser.id },
    });
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toAuthUser(user);
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const verifyUrl = `${frontendUrl.replace(/\/$/, '')}/auth/verify-email?token=${rawToken}`;

    await this.mailService.sendVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      verifyUrl,
    });
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessSecret =
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessTtl = this.configService.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshTtl = this.configService.get<string>('JWT_REFRESH_TTL', '7d');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl as `${number}m`,
    });

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: refreshSecret,
        expiresIn: refreshTtl as `${number}d`,
      },
    );

    const expiresAt = this.getRefreshExpiresAt(refreshToken, refreshTtl);
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ sub: string; email: string; role: string }> {
    try {
      return await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshExpiresAt(refreshToken: string, ttl: string): Date {
    const decoded = this.jwtService.decode<{ exp?: number }>(refreshToken);
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);
    }
    return new Date(Date.now() + this.parseTtlMs(ttl));
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * (multipliers[unit] ?? 86_400_000);
  }

  private toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    };
  }
}
