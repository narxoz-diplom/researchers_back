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

export interface PasswordResetByAdminEmailPayload {
  to: string;
  fullName: string;
  newPassword: string;
}

export interface AccountCreatedByAdminEmailPayload {
  to: string;
  fullName: string;
  password: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'администратор',
  AUTHOR: 'автор курсов',
  SUBSCRIBER: 'слушатель',
};

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

  /** False in local development without SMTP: mails are logged instead of sent. */
  isConfigured(): boolean {
    return this.transporter !== null;
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

    await this.deliver(payload.to, subject, text, html);
  }

  async sendPasswordResetByAdminEmail(
    payload: PasswordResetByAdminEmailPayload,
  ): Promise<void> {
    const subject = 'Новый пароль — Researchers.kz';
    const text = [
      `Здравствуйте, ${payload.fullName}!`,
      '',
      'Администратор платформы Researchers.kz установил для вашего аккаунта новый пароль:',
      payload.newPassword,
      '',
      'Рекомендуем войти и сменить пароль в профиле после первого входа.',
      'Если вы не ожидали это письмо — свяжитесь с поддержкой.',
    ].join('\n');

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Researchers.kz</h2>
        <p>Здравствуйте, <strong>${this.escapeHtml(payload.fullName)}</strong>!</p>
        <p>Администратор платформы установил для вашего аккаунта новый пароль:</p>
        <p style="font-size:18px;font-weight:700;letter-spacing:0.04em;background:#f3f4f6;padding:12px 16px;border-radius:8px;display:inline-block">
          ${this.escapeHtml(payload.newPassword)}
        </p>
        <p>Рекомендуем войти и сменить пароль в профиле после первого входа.</p>
        <p style="font-size:13px;color:#6b7280">Если вы не ожидали это письмо — свяжитесь с поддержкой.</p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.warn(
        `Password reset for ${payload.to}: newPassword=${payload.newPassword}`,
      );
      return;
    }

    await this.deliver(payload.to, subject, text, html);
  }

  async sendAccountCreatedByAdminEmail(
    payload: AccountCreatedByAdminEmailPayload,
  ): Promise<void> {
    const frontendUrl = this.configService
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    const loginUrl = `${frontendUrl}/auth/login`;
    const roleLabel = ROLE_LABELS[payload.role] ?? payload.role;
    const subject = 'Для вас создан аккаунт — Researchers.kz';
    const text = [
      `Здравствуйте, ${payload.fullName}!`,
      '',
      `Администратор платформы Researchers.kz создал для вас аккаунт (роль: ${roleLabel}).`,
      `Логин: ${payload.to}`,
      `Пароль: ${payload.password}`,
      '',
      `Вход: ${loginUrl}`,
      'Рекомендуем сменить пароль в профиле после первого входа.',
      'Если вы не ожидали это письмо — свяжитесь с поддержкой.',
    ].join('\n');

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Researchers.kz</h2>
        <p>Здравствуйте, <strong>${this.escapeHtml(payload.fullName)}</strong>!</p>
        <p>Администратор платформы создал для вас аккаунт (роль: <strong>${this.escapeHtml(roleLabel)}</strong>).</p>
        <p>Логин: <strong>${this.escapeHtml(payload.to)}</strong></p>
        <p>Пароль:</p>
        <p style="font-size:18px;font-weight:700;letter-spacing:0.04em;background:#f3f4f6;padding:12px 16px;border-radius:8px;display:inline-block">
          ${this.escapeHtml(payload.password)}
        </p>
        <p><a href="${this.escapeHtml(loginUrl)}">Войти на платформу</a></p>
        <p>Рекомендуем сменить пароль в профиле после первого входа.</p>
        <p style="font-size:13px;color:#6b7280">Если вы не ожидали это письмо — свяжитесь с поддержкой.</p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.warn(
        `Account created for ${payload.to} (${payload.role}): password=${payload.password}`,
      );
      return;
    }

    await this.deliver(payload.to, subject, text, html);
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

    await this.deliver(payload.to, subject, text, html);
  }

  async sendAuthorDecisionEmail(payload: {
    to: string;
    fullName: string;
    approved: boolean;
    note?: string | null;
    studioUrl: string;
  }): Promise<void> {
    const subject = payload.approved
      ? 'Авторлық өтінім мақұлданды / Заявка автора одобрена — Researchers.kz'
      : 'Авторлық өтінім қабылданбады / Заявка автора отклонена — Researchers.kz';
    const kk = payload.approved
      ? 'Әкімші сіздің офертаңызды мақұлдады. Енді студияда курстарыңызды қосып, өңдей аласыз.'
      : 'Әкімші сіздің офертаңызды қабылдамады. Деректерді түзетіп, студияда өтінімді қайта жібере аласыз.';
    const ru = payload.approved
      ? 'Администратор одобрил вашу оферту. Теперь вы можете добавлять и редактировать курсы в студии.'
      : 'Администратор отклонил вашу оферту. Исправьте данные и отправьте заявку повторно в студии.';
    const note = payload.note?.trim();

    const text = [
      `${payload.fullName}, сәлеметсіз бе! / Здравствуйте!`,
      '',
      kk,
      ru,
      ...(note ? ['', `Әкімші түсініктемесі / Комментарий: ${note}`] : []),
      '',
      payload.studioUrl,
    ].join('\n');

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Researchers.kz</h2>
        <p><strong>${this.escapeHtml(payload.fullName)}</strong>, сәлеметсіз бе! / Здравствуйте!</p>
        <p>${kk}</p>
        <p style="color:#4b5563">${ru}</p>
        ${note ? `<p style="background:#f3f4f6;padding:12px 16px;border-radius:8px">${this.escapeHtml(note)}</p>` : ''}
        <p><a href="${this.escapeHtml(payload.studioUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Студия / Studio</a></p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.warn(
        `Author decision for ${payload.to}: approved=${payload.approved}`,
      );
      return;
    }

    await this.deliver(payload.to, subject, text, html);
  }

  /** Sends through SMTP and logs the outcome, so production logs show deliveries and SMTP errors. */
  private async deliver(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    if (!this.transporter) {
      return;
    }
    try {
      const info = (await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text,
        html,
      })) as { messageId?: string; response?: string };
      this.logger.log(
        `Mail sent to ${to} (${subject}) messageId=${info.messageId ?? '?'} ${info.response ?? ''}`.trim(),
      );
    } catch (error) {
      this.logger.error(
        `Mail to ${to} (${subject}) failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
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
