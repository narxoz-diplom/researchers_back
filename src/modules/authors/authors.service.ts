import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthorApplication, AuthorStatus, Role, User } from '@prisma/client';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TelegramService } from '../telegram/telegram.service';
import { AUTHOR_OFFER_VERSION } from './authors.constants';
import { AuthorApplicationDto } from './dto/author-application.dto';
import {
  AdminAuthorDto,
  AuthorApplicationResponseDto,
  MyAuthorApplicationDto,
} from './dto/author-response.dto';

type AuthorWithApplication = User & {
  authorApplication: AuthorApplication | null;
  _count?: { courses: number };
};

@Injectable()
export class AuthorsService {
  private readonly logger = new Logger(AuthorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  /** Prisma create payload for the offer accepted at signup. */
  static applicationData(dto: AuthorApplicationDto) {
    if (dto.acceptOffer !== true) {
      throw new BadRequestException(ErrorCode.OFFER_NOT_ACCEPTED);
    }
    return {
      legalName: dto.legalName,
      iin: dto.iin,
      phone: dto.phone,
      city: dto.city,
      offerVersion: AUTHOR_OFFER_VERSION,
      acceptedAt: new Date(),
    };
  }

  notifyNewApplication(
    user: Pick<User, 'email' | 'fullName'>,
    legalName: string,
    resubmitted: boolean,
  ): void {
    void this.telegramService
      .notifyAuthorApplication({
        email: user.email,
        fullName: user.fullName,
        legalName,
        submittedAt: new Date(),
        resubmitted,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Telegram author notification error: ${message}`);
      });
  }

  async getMine(user: JwtPayloadUser): Promise<MyAuthorApplicationDto> {
    const author = await this.findAuthorOrThrow(user.id);
    return {
      status: author.authorStatus ?? AuthorStatus.PENDING,
      ...(author.authorApplication
        ? { application: toApplicationDto(author.authorApplication) }
        : {}),
    };
  }

  /** Author edits the offer details while waiting, or resubmits after a rejection. */
  async resubmit(
    user: JwtPayloadUser,
    dto: AuthorApplicationDto,
  ): Promise<MyAuthorApplicationDto> {
    const author = await this.findAuthorOrThrow(user.id);
    if (author.authorStatus === AuthorStatus.APPROVED) {
      throw new BadRequestException(ErrorCode.AUTHOR_INVALID_STATUS);
    }

    const data = AuthorsService.applicationData(dto);
    const reset = { reviewNote: null, reviewedAt: null, reviewedById: null };

    await this.prisma.$transaction([
      this.prisma.authorApplication.upsert({
        where: { userId: author.id },
        create: { userId: author.id, ...data },
        update: { ...data, ...reset },
      }),
      this.prisma.user.update({
        where: { id: author.id },
        data: { authorStatus: AuthorStatus.PENDING },
      }),
    ]);

    this.notifyNewApplication(
      author,
      data.legalName,
      author.authorStatus === AuthorStatus.REJECTED,
    );
    return this.getMine(user);
  }

  async listForAdmin(status?: AuthorStatus): Promise<AdminAuthorDto[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: Role.AUTHOR, ...(status ? { authorStatus: status } : {}) },
      include: {
        authorApplication: true,
        _count: { select: { courses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAdminDto);
  }

  async approve(
    admin: JwtPayloadUser,
    userId: string,
  ): Promise<AdminAuthorDto> {
    return this.decide(admin, userId, AuthorStatus.APPROVED, null);
  }

  async reject(
    admin: JwtPayloadUser,
    userId: string,
    note: string,
  ): Promise<AdminAuthorDto> {
    return this.decide(admin, userId, AuthorStatus.REJECTED, note.trim());
  }

  private async decide(
    admin: JwtPayloadUser,
    userId: string,
    status: AuthorStatus,
    note: string | null,
  ): Promise<AdminAuthorDto> {
    if (admin.role !== Role.ADMIN) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN_ROLE);
    }

    const author = await this.findAuthorOrThrow(userId);
    if (author.authorStatus === status) {
      throw new BadRequestException(ErrorCode.AUTHOR_INVALID_STATUS);
    }
    // Approval confirms an accepted offer; an author without one cannot be approved.
    if (status === AuthorStatus.APPROVED && !author.authorApplication) {
      throw new BadRequestException(ErrorCode.AUTHOR_APPLICATION_REQUIRED);
    }

    const review = {
      reviewNote: note,
      reviewedAt: new Date(),
      reviewedById: admin.id,
    };
    await this.prisma.$transaction([
      ...(author.authorApplication
        ? [
            this.prisma.authorApplication.update({
              where: { userId },
              data: review,
            }),
          ]
        : []),
      this.prisma.user.update({
        where: { id: userId },
        data: { authorStatus: status },
      }),
    ]);

    const frontendUrl = this.configService
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    void this.mailService
      .sendAuthorDecisionEmail({
        to: author.email,
        fullName: author.fullName,
        approved: status === AuthorStatus.APPROVED,
        note,
        studioUrl: `${frontendUrl}/studio`,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Author decision email error: ${message}`);
      });

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        authorApplication: true,
        _count: { select: { courses: true } },
      },
    });
    return toAdminDto(updated);
  }

  private async findAuthorOrThrow(
    userId: string,
  ): Promise<AuthorWithApplication> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authorApplication: true },
    });
    if (!user || user.role !== Role.AUTHOR) {
      throw new NotFoundException('Author not found');
    }
    return user;
  }
}

function toApplicationDto(
  app: AuthorApplication,
): AuthorApplicationResponseDto {
  return {
    legalName: app.legalName,
    iin: app.iin,
    phone: app.phone,
    city: app.city,
    offerVersion: app.offerVersion,
    acceptedAt: app.acceptedAt.toISOString(),
    ...(app.reviewNote ? { reviewNote: app.reviewNote } : {}),
    ...(app.reviewedAt ? { reviewedAt: app.reviewedAt.toISOString() } : {}),
  };
}

function toAdminDto(user: AuthorWithApplication): AdminAuthorDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.authorStatus ?? AuthorStatus.PENDING,
    emailVerified: user.emailVerified,
    coursesCount: user._count?.courses ?? 0,
    createdAt: user.createdAt.toISOString(),
    ...(user.authorApplication
      ? { application: toApplicationDto(user.authorApplication) }
      : {}),
  };
}
