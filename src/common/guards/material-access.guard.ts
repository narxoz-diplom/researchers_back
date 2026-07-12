import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, CourseStatus } from '@prisma/client';
import { Request } from 'express';
import { LESSONS_REPOSITORY } from '../../modules/lessons/lessons.constants';
import type { ILessonsRepository } from '../../modules/lessons/lessons.repository.interface';
import { EnrollmentsService } from '../../modules/enrollments/enrollments.service';
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class MaterialAccessGuard implements CanActivate {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    @Inject(LESSONS_REPOSITORY)
    private readonly lessonsRepository: ILessonsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayloadUser }>();
    const user = request.user;

    const rawId = request.params.id;
    const materialId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!materialId) {
      throw new ForbiddenException();
    }

    const material = await this.lessonsRepository.findMaterialById(materialId);
    if (!material) {
      throw new NotFoundException('Material not found');
    }

    if (
      material.lesson.isPublished &&
      material.lesson.course.status === CourseStatus.PUBLISHED
    ) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException();
    }

    if (user.role === Role.ADMIN) {
      return true;
    }

    if (material.lesson.course.authorId === user.id) {
      return true;
    }

    const hasAccess = await this.enrollmentsService.hasApprovedAccess(
      user.id,
      material.lesson.course.id,
    );
    if (!hasAccess) {
      throw new ForbiddenException(ErrorCode.SUBSCRIPTION_REQUIRED);
    }

    return true;
  }
}
