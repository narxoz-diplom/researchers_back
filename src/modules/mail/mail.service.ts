import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface VerificationEmailPayload {
  to: string;
  fullName: string;
  verifyUrl: string;
}

export interface LessonIndexFailedEmailPayload {
  to: string;
  fullName: string;
  lessonTitle: string;
  jobId: string;
  errorId: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private fromAddress = 'Researchers.kz <noreply@researchers.kz>';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ?? this.fromAddress;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log('SMTP mail transport configured');
      return;
    }

    this.logger.warn(
      'SMTP is not configured; verification emails will be logged to the console',
    );
  }

  async sendVerificationEmail(
    payload: VerificationEmailPayload,
  ): Promise<void> {
    const subject = 'Подтвердите email — Researchers.kz';
    const text = [
      `Здравствуйте, ${payload.fullName}!`,
      '',
      'Подтвердите email, чтобы войти в Researchers.kz:',
      payload.verifyUrl,
      '',
      'Ссылка действует 24 часа. Если вы не регистрировались — проигнорируйте это письмо.',
    ].join('\n');

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Researchers.kz</h2>
        <p>Здравствуйте, <strong>${this.escapeHtml(payload.fullName)}</strong>!</p>
        <p>Подтвердите email, чтобы завершить регистрацию:</p>
        <p>
          <a href="${payload.verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
            Подтвердить email
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280">Ссылка действует 24 часа.</p>
        <p style="font-size:12px;color:#9ca3af;word-break:break-all">${payload.verifyUrl}</p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.warn(
        `Verification link for ${payload.to}: ${payload.verifyUrl}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: payload.to,
      subject,
      text,
      html,
    });
  }

  async sendLessonIndexFailedEmail(
    payload: LessonIndexFailedEmailPayload,
  ): Promise<void> {
    const subject = 'Ошибка индексации урока — Researchers.kz';
    const text = [
      `Здравствуйте, ${payload.fullName}!`,
      '',
      `Не удалось проиндексировать материалы урока «${payload.lessonTitle}» для AI.`,
      `Код обращения: ${payload.jobId}`,
      `ID ошибки: ${payload.errorId}`,
      '',
      'Повторите сохранение урока позже или обратитесь в техподдержку, указав код обращения.',
    ].join('\n');

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Researchers.kz</h2>
        <p>Здравствуйте, <strong>${this.escapeHtml(payload.fullName)}</strong>!</p>
        <p>Не удалось проиндексировать материалы урока <strong>${this.escapeHtml(payload.lessonTitle)}</strong> для AI.</p>
        <p><strong>Код обращения:</strong> ${this.escapeHtml(payload.jobId)}</p>
        <p><strong>ID ошибки:</strong> ${this.escapeHtml(payload.errorId)}</p>
        <p>Повторите сохранение урока позже или обратитесь в техподдержку, указав код обращения.</p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.warn(
        `Lesson index failed for ${payload.to}: jobId=${payload.jobId} errorId=${payload.errorId}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: payload.to,
      subject,
      text,
      html,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
