import { Module } from '@nestjs/common';
import { MailModule } from '../modules/mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [HealthController],
})
export class HealthModule {}
