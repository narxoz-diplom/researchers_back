import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { EnrollmentsService } from '../../modules/enrollments/enrollments.service';
import { LESSONS_REPOSITORY } from '../../modules/lessons/lessons.constants';
import type { ILessonsRepository } from '../../modules/lessons/lessons.repository.interface';
import { MediaTokenService } from '../../modules/media/media-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import {
  MEDIA_KIND_KEY,
  MediaKindValue,
} from '../decorators/media-kind.decorator';
import { ErrorCode } from '../errors/error-codes';

interface Viewer {
  id: string;
  role: Role;
}

/**
 * Lesson videos and materials are paid content. The viewer is identified by a
 * bearer token or by the short-lived `?t=` media token the lesson endpoint
 * issued, and must be an admin, the course author or an approved student.
 */
@Injectable()
export class LessonMediaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly mediaTokenService: MediaTokenService,
    private readonly prisma: PrismaService,
    @Inject(LESSONS_REPOSITORY)
    private readonly lessonsRepository: ILessonsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayloadUser }>();
    const kind = this.reflector.get<MediaKindValue | undefined>(
      MEDIA_KIND_KEY,
      context.getHandler(),
    );

    const rawId = request.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !kind) {
      throw new ForbiddenException();
    }

    const target =
      kind === 'video'
        ? await this.lessonsRepository.findVideoById(id)
        : await this.lessonsRepository.findMaterialById(id);
    if (!target) {
      throw new NotFoundException(
        kind === 'video' ? 'Video not found' : 'Material not found',
      );
    }

    const lesson = target.lesson;
    const viewer = await this.resolveViewer(request, lesson.id);
    if (!viewer) {
      throw new ForbiddenException(ErrorCode.SUBSCRIPTION_REQUIRED);
    }

    if (viewer.role === Role.ADMIN || lesson.course.authorId === viewer.id) {
      return true;
    }

    if (!lesson.isPublished) {
      throw new NotFoundException('Lesson not found');
    }

    const hasAccess = await this.enrollmentsService.hasApprovedAccess(
      viewer.id,
      lesson.course.id,
    );
    if (!hasAccess) {
      throw new ForbiddenException(ErrorCode.SUBSCRIPTION_REQUIRED);
    }
    return true;
  }

  private async resolveViewer(
    request: Request & { user?: JwtPayloadUser },
    lessonId: string,
  ): Promise<Viewer | null> {
    if (request.user) {
      return { id: request.user.id, role: request.user.role as Role };
    }

    const raw = request.query.t;
    const token = typeof raw === 'string' ? raw : null;
    if (!token) {
      return null;
    }
    const claims = this.mediaTokenService.verify(token);
    if (!claims || claims.lessonId !== lessonId) {
      return null;
    }
    return this.prisma.user.findUnique({
      where: { id: claims.userId },
      select: { id: true, role: true },
    });
  }
}
