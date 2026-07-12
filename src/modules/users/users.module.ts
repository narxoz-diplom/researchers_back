import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [MediaModule, MailModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
