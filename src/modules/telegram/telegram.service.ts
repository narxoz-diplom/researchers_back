import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EnrollmentTelegramEvent = 'request' | 'resubmit' | 'purchase';

export interface EnrollmentTelegramPayload {
  email: string;
  courseTitle: string;
  submittedAt: Date;
  event: EnrollmentTelegramEvent;
  paidAmountCents?: number;
  expectedAmountCents?: number;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private botToken: string | null = null;
  private chatId: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.botToken =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim() || null;
    this.chatId =
      this.configService.get<string>('TELEGRAM_CHAT_ID')?.trim() || null;

    if (!this.botToken || !this.chatId) {
      this.logger.warn(
        'Telegram is not configured; enrollment notifications will be logged to the console',
      );
      return;
    }

    this.logger.log('Telegram enrollment notifications enabled');
    void this.verifyBot().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Telegram bot verification failed: ${message}`);
    });
  }

  async notifyEnrollment(payload: EnrollmentTelegramPayload): Promise<void> {
    const title = this.titleForEvent(payload.event);
    const when = this.formatDate(payload.submittedAt);

    const amountLine =
      payload.paidAmountCents != null
        ? `💰 <b>Сумма:</b> ${this.escapeHtml(this.formatKzt(payload.paidAmountCents))}${
            payload.expectedAmountCents != null
              ? ` / ${this.escapeHtml(this.formatKzt(payload.expectedAmountCents))}`
              : ''
          }`
        : null;

    const text = [
      `📩 <b>${this.escapeHtml(title)}</b>`,
      '',
      `👤 <b>Email:</b> ${this.escapeHtml(payload.email)}`,
      `📚 <b>Курс:</b> ${this.escapeHtml(payload.courseTitle)}`,
      `🕐 <b>Дата:</b> ${this.escapeHtml(when)}`,
      ...(amountLine ? ['', amountLine] : []),
    ].join('\n');

    await this.sendMessage(
      text,
      `${title} — ${payload.email} — ${payload.courseTitle}`,
    );
  }

  private titleForEvent(event: EnrollmentTelegramEvent): string {
    switch (event) {
      case 'purchase':
        return 'Оплата Kaspi QR — проверьте';
      case 'resubmit':
        return 'Повторная заявка на курс';
      default:
        return 'Новая заявка на курс';
    }
  }

  private async verifyBot(): Promise<void> {
    if (!this.botToken) return;

    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/getMe`,
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`getMe failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { username?: string };
    };
    if (!data.ok) {
      throw new Error('getMe returned ok=false');
    }

    this.logger.log(
      `Telegram bot connected: @${data.result?.username ?? 'unknown'}`,
    );
  }

  private async sendMessage(text: string, devFallback: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      this.logger.warn(`Telegram (dev): ${devFallback}`);
      return;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      if (body.includes('chat not found')) {
        this.logger.error(
          'Telegram sendMessage failed: chat not found. Open the bot in Telegram, send /start, then set TELEGRAM_CHAT_ID from getUpdates (see README).',
        );
        return;
      }
      throw new Error(`sendMessage failed (${response.status}): ${body}`);
    }

    this.logger.log('Telegram notification sent');
  }

  private formatKzt(cents: number): string {
    return `${(cents / 100).toLocaleString('ru-RU')} ₸`;
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Almaty',
    }).format(date);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}
