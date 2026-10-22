import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { TelegramModule } from '../telegram/telegram.module';
import {
  AdminAuthorsController,
  MeAuthorApplicationController,
} from './authors.controller';
import { AuthorsService } from './authors.service';

@Module({
  imports: [MailModule, TelegramModule],
  controllers: [MeAuthorApplicationController, AdminAuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
