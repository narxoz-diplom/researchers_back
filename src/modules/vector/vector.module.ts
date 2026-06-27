import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { LessonIndexNotificationService } from './lesson-index-notification.service';
import { LessonIndexService } from './lesson-index.service';
import { RagClientService } from './rag-client.service';
import { RagIndexCallbackController } from './rag-index-callback.controller';
import { VectorIndexService } from './vector-index.service';

@Module({
  imports: [MailModule, MediaModule],
  controllers: [RagIndexCallbackController],
  providers: [
    RagClientService,
    VectorIndexService,
    LessonIndexService,
    LessonIndexNotificationService,
  ],
  exports: [RagClientService, VectorIndexService, LessonIndexService],
})
export class VectorModule {}
