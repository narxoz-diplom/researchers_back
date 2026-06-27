import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LessonIndexNotificationService {
  private readonly logger = new Logger(LessonIndexNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async notifyIndexFailed(params: {
    errorId: string;
    lessonId: string;
    lessonTitle: string;
    jobId: string;
    authorEmail: string;
    authorName: string;
  }): Promise<void> {
    const existing = await this.prisma.lessonVectorIndexError.findUnique({
      where: { id: params.errorId },
      select: { notifiedAt: true },
    });
    if (existing?.notifiedAt) {
      return;
    }

    try {
      await this.mailService.sendLessonIndexFailedEmail({
        to: params.authorEmail,
        fullName: params.authorName,
        lessonTitle: params.lessonTitle,
        jobId: params.jobId,
        errorId: params.errorId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send lesson index error email errorId=${params.errorId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.prisma.lessonVectorIndexError.update({
      where: { id: params.errorId },
      data: { notifiedAt: new Date() },
    });
  }
}
