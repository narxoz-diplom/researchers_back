import { Module } from '@nestjs/common';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { CoursesModule } from '../courses/courses.module';
import { MediaModule } from '../media/media.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CourseLessonsController } from './course-lessons.controller';
import { LESSONS_REPOSITORY } from './lessons.constants';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { MaterialsController } from './materials.controller';
import { PrismaLessonsRepository } from './prisma-lessons.repository';
import { VideosController } from './videos.controller';

@Module({
  imports: [CoursesModule, MediaModule, EnrollmentsModule],
  controllers: [
    CourseLessonsController,
    LessonsController,
    VideosController,
    MaterialsController,
  ],
  providers: [
    LessonsService,
    LessonOwnerGuard,
    SubscriptionGuard,
    {
      provide: LESSONS_REPOSITORY,
      useClass: PrismaLessonsRepository,
    },
  ],
  exports: [LessonsService, LESSONS_REPOSITORY],
})
export class LessonsModule {}
