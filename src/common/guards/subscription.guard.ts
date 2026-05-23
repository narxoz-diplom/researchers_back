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
import { LESSONS_REPOSITORY } from '../../modules/lessons/lessons.constants';
import type { ILessonsRepository } from '../../modules/lessons/lessons.repository.interface';
import { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service';
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
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

    const rawId = request.params.id ?? request.params.lessonId;
    const lessonId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!lessonId) {
      throw new ForbiddenException();
    }

    const lesson = await this.lessonsRepository.findByIdWithCourse(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.course.authorId === user.id) {
      return true;
    }

    const active = await this.subscriptionsService.hasActive(user.id);
    if (!active) {
      throw new ForbiddenException(ErrorCode.SUBSCRIPTION_REQUIRED);
    }

    return true;
  }
}
