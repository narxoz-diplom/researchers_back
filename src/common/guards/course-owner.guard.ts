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
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class CourseOwnerGuard implements CanActivate {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: ICoursesRepository,
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

    const rawId =
      request.params.id ??
      request.params.courseId ??
      (request.body as { courseId?: string } | undefined)?.courseId;
    const courseId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!courseId) {
      throw new ForbiddenException();
    }

    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.authorId !== user.id) {
      throw new ForbiddenException(ErrorCode.OWNERSHIP_REQUIRED);
    }

    return true;
  }
}
