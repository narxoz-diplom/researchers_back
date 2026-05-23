import { Module } from '@nestjs/common';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { LessonsModule } from '../lessons/lessons.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LessonCompleteController } from './lesson-complete.controller';
import { MeProgressController } from './me-progress.controller';
import { PROGRESS_REPOSITORY } from './progress.constants';
import { PrismaProgressRepository } from './prisma-progress.repository';
import { ProgressService } from './progress.service';

@Module({
  imports: [LessonsModule, EnrollmentsModule],
  controllers: [LessonCompleteController, MeProgressController],
  providers: [
    ProgressService,
    SubscriptionGuard,
    {
      provide: PROGRESS_REPOSITORY,
      useClass: PrismaProgressRepository,
    },
  ],
  exports: [ProgressService],
})
export class ProgressModule {}
