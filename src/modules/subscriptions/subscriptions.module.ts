import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { MeSubscriptionsController } from './me-subscriptions.controller';
import { SUBSCRIPTIONS_REPOSITORY } from './subscriptions.constants';
import { SubscriptionsCron } from './subscriptions.cron';
import { PrismaSubscriptionsRepository } from './prisma-subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [UsersModule],
  controllers: [MeSubscriptionsController, AdminSubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionsCron,
    {
      provide: SUBSCRIPTIONS_REPOSITORY,
      useClass: PrismaSubscriptionsRepository,
    },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
