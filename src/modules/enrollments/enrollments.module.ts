import { Module } from '@nestjs/common';
import { CourseOwnerGuard } from '../../common/guards/course-owner.guard';
import { COURSES_REPOSITORY } from '../courses/courses.constants';
import { PrismaCoursesRepository } from '../courses/prisma-courses.repository';
import { ENROLLMENTS_REPOSITORY } from './enrollments.constants';
import { CourseEnrollmentsController } from './course-enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { PrismaEnrollmentsRepository } from './prisma-enrollments.repository';

@Module({
  controllers: [CourseEnrollmentsController],
  providers: [
    EnrollmentsService,
    CourseOwnerGuard,
    {
      provide: ENROLLMENTS_REPOSITORY,
      useClass: PrismaEnrollmentsRepository,
    },
    {
      provide: COURSES_REPOSITORY,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [EnrollmentsService, ENROLLMENTS_REPOSITORY],
})
export class EnrollmentsModule {}
