import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthorStatus, Role } from '@prisma/client';
import { ErrorCode } from '../../common/errors/error-codes';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorsService } from '../authors/authors.service';
import { MailService } from '../mail/mail.service';
import { UsersRepository } from '../users/users.repository';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  RegisterResponseDto,
  VerificationSentResponseDto,
} from './dto/register-response.dto';

const BCRYPT_ROUNDS = 10;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly authorsService: AuthorsService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(ErrorCode.EMAIL_TAKEN);
    }

    if (dto.role !== Role.SUBSCRIBER && dto.role !== Role.AUTHOR) {
      throw new BadRequestException(ErrorCode.FORBIDDEN_ROLE);
    }

    const isAuthor = dto.role === Role.AUTHOR;
    // Authors sign up by accepting the public offer and may manage courses at once;
    // an admin can still revoke them later from the Authors page.
    if (isAuthor && !dto.authorApplication) {
      throw new BadRequestException(ErrorCode.AUTHOR_APPLICATION_REQUIRED);
    }
    const application = isAuthor
      ? AuthorsService.applicationData(dto.authorApplication!)
      : null;

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        emailVerified: false,
        ...(application
          ? {
              authorStatus: AuthorStatus.APPROVED,
              authorApplication: { create: application },
            }
          : {}),
      },
    });

    // The account exists from here on; a refused mail must not turn into a 500
    // that leaves the user unable to retry. They can resend from the next page.
    let verifyUrl = '';
    let mailFailed = false;
    try {
      verifyUrl = await this.sendVerificationEmail(user);
    } catch (error) {
      mailFailed = true;
      this.logger.error(
        `Verification mail for ${user.email} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (application) {
      this.authorsService.notifyNewApplication(
        user,
        application.legalName,
        false,
      );
    }

    return {
      message: 'CHECK_EMAIL',
      email: user.email,
      ...(verifyUrl ? this.devVerifyUrl(verifyUrl) : {}),
      ...(mailFailed ? { mailFailed: true } : {}),
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
  ): Promise<VerificationSentResponseDto> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user || user.emailVerified) {
      return { message: 'VERIFICATION_SENT' };
    }

    let verifyUrl: string;
    try {
      verifyUrl = await this.sendVerificationEmail(user);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Verification mail for ${user.email} failed: ${detail}`,
      );
      throw new BadGatewayException({
        statusCode: 502,
        message: ErrorCode.MAIL_DELIVERY_FAILED,
        detail,
      });
    }
    return { message: 'VERIFICATION_SENT', ...this.devVerifyUrl(verifyUrl) };
  }

  /**
   * Without SMTP the link only lands in the server log, which makes the signup
   * flow untestable from the browser. Outside production it is returned to the
   * client instead; with SMTP configured, or in production, it never is.
   */
  private devVerifyUrl(verifyUrl: string): { devVerifyUrl?: string } {
    const production =
      this.configService.get<string>('NODE_ENV') === 'production';
    if (production || this.mailService.isConfigured()) {
      return {};
    }
    return { devVerifyUrl: verifyUrl };
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

  private async sendVerificationEmail(user: User): Promise<string> {
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
    return verifyUrl;
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
      ...(user.authorStatus ? { authorStatus: user.authorStatus } : {}),
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    };
  }
}
