import { Module } from '@nestjs/common';
import { CourseOwnerGuard } from '../../common/guards/course-owner.guard';
import { MediaModule } from '../media/media.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { COURSES_REPOSITORY } from './courses.constants';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PrismaCoursesRepository } from './prisma-courses.repository';

@Module({
  imports: [SubscriptionsModule, MediaModule],
  controllers: [CoursesController],
  providers: [
    CoursesService,
    CourseOwnerGuard,
    {
      provide: COURSES_REPOSITORY,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [CoursesService, COURSES_REPOSITORY, CourseOwnerGuard],
})
export class CoursesModule {}
