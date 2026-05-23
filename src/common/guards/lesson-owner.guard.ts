import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { COURSES_REPOSITORY } from '../../modules/courses/courses.constants';
import type { ICoursesRepository } from '../../modules/courses/courses.repository.interface';
import { LESSONS_REPOSITORY } from '../../modules/lessons/lessons.constants';
import type { ILessonsRepository } from '../../modules/lessons/lessons.repository.interface';
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class LessonOwnerGuard implements CanActivate {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: ICoursesRepository,
    @Inject(LESSONS_REPOSITORY)
    private readonly lessonsRepository: ILessonsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayloadUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException();
    }

    if (user.role === Role.ADMIN) {
      return true;
    }

    const authorId = await this.resolveCourseAuthorId(request);
    if (!authorId) {
      throw new ForbiddenException();
    }

    if (authorId !== user.id) {
      throw new ForbiddenException(ErrorCode.OWNERSHIP_REQUIRED);
    }

    return true;
  }

  private async resolveCourseAuthorId(
    request: Request,
  ): Promise<string | null> {
    const courseIdRaw = request.params.courseId;
    const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw;
    if (courseId) {
      const course = await this.coursesRepository.findById(courseId);
      if (!course) {
        throw new NotFoundException('Course not found');
      }
      return course.authorId;
    }

    const resourceIdRaw = request.params.id ?? request.params.lessonId;
    const resourceId = Array.isArray(resourceIdRaw)
      ? resourceIdRaw[0]
      : resourceIdRaw;
    if (!resourceId) {
      return null;
    }

    const lesson = await this.lessonsRepository.findByIdWithCourse(resourceId);
    if (lesson) {
      return lesson.course.authorId;
    }

    const video = await this.lessonsRepository.findVideoById(resourceId);
    if (video) {
      return video.lesson.course.authorId;
    }

    const material = await this.lessonsRepository.findMaterialById(resourceId);
    if (material) {
      return material.lesson.course.authorId;
    }

    throw new NotFoundException('Resource not found');
  }
}
