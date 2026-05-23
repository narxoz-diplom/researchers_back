import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionsCron {
  private readonly logger = new Logger(SubscriptionsCron.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'UTC' })
  async handleExpiredSubscriptions(): Promise<void> {
    const count = await this.subscriptionsService.expirePastDue();
    if (count > 0) {
      this.logger.log(`Marked ${count} subscription(s) as EXPIRED`);
    }
  }
}
