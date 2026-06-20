import { Module } from '@nestjs/common';
import { CourseOwnerGuard } from '../../common/guards/course-owner.guard';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { MediaModule } from '../media/media.module';
import { COURSES_REPOSITORY } from './courses.constants';
import { CoursePricingService } from './course-pricing.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PrismaCoursesRepository } from './prisma-courses.repository';

@Module({
  imports: [EnrollmentsModule, MediaModule],
  controllers: [CoursesController],
  providers: [
    CoursesService,
    CoursePricingService,
    CourseOwnerGuard,
    {
      provide: COURSES_REPOSITORY,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [
    CoursesService,
    CoursePricingService,
    COURSES_REPOSITORY,
    CourseOwnerGuard,
  ],
})
export class CoursesModule {}
