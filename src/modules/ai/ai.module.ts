import { forwardRef, Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LessonsModule } from '../lessons/lessons.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { VectorModule } from '../vector/vector.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthorAiSettingsService } from './author-ai-settings.service';
import { LessonAiController } from './lesson-ai.controller';
import { LessonChatQuotaService } from './lesson-chat-quota.service';
import { LessonGenerationService } from './lesson-generation.service';
import { MeAiSettingsController } from './me-ai-settings.controller';
import { RagGenerationCallbackController } from './rag-generation-callback.controller';

@Module({
  imports: [
    VectorModule,
    CoursesModule,
    forwardRef(() => LessonsModule),
    EnrollmentsModule,
    SubscriptionsModule,
  ],
  controllers: [
    AiController,
    MeAiSettingsController,
    LessonAiController,
    RagGenerationCallbackController,
  ],
  providers: [
    AiService,
    AuthorAiSettingsService,
    LessonChatQuotaService,
    LessonGenerationService,
  ],
  exports: [AiService, AuthorAiSettingsService],
})
export class AiModule {}
