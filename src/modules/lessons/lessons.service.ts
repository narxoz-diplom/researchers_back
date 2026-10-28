import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, Prisma, Role, VideoSource } from '@prisma/client';
import type { Request, Response } from 'express';
import * as mammoth from 'mammoth';
import { extname } from 'path';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { parseYoutubeUrl } from '../../common/utils/youtube-url';
import { COURSES_REPOSITORY } from '../courses/courses.constants';
import type { ICoursesRepository } from '../courses/courses.repository.interface';
import { MediaStreamService } from '../media/media-stream.service';
import { MediaTokenService } from '../media/media-token.service';
import { MediaService } from '../media/media.service';
import { LessonIndexService } from '../vector/lesson-index.service';
import { UploadResourceType } from '../media/media.types';
import {
  LESSONS_REPOSITORY,
  MAX_MATERIAL_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from './lessons.constants';
import type { ILessonsRepository } from './lessons.repository.interface';
import { AttachMaterialDto } from './dto/attach-material.dto';
import { AttachVideoDto } from './dto/attach-video.dto';
import { AttachYoutubeVideoDto } from './dto/attach-youtube-video.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  LessonDetailResponseDto,
  LessonMaterialEntityDto,
  LessonSummaryResponseDto,
  LessonVideoEntityDto,
} from './dto/lesson-response.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import {
  canRenderMaterialAsHtml,
  toLessonDetail,
  toLessonMaterial,
  toLessonSummary,
  toLessonVideo,
} from './lessons.mapper';

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
};

@Injectable()
export class LessonsService {
  constructor(
    @Inject(LESSONS_REPOSITORY)
    private readonly lessonsRepository: ILessonsRepository,
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: ICoursesRepository,
    private readonly mediaService: MediaService,
    private readonly mediaTokenService: MediaTokenService,
    private readonly mediaStreamService: MediaStreamService,
    private readonly lessonIndexService: LessonIndexService,
  ) {}

  async listByCourse(
    courseId: string,
    user: JwtPayloadUser | null,
  ): Promise<LessonSummaryResponseDto[]> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    this.assertCanViewCourse(course.status, course.authorId, user);

    const lessons = await this.lessonsRepository.findByCourseId(courseId);
    const canManage = user
      ? this.canManageLessons(course.authorId, user)
      : false;
    const visible = canManage ? lessons : lessons.filter((l) => l.isPublished);
    return visible.map(toLessonSummary);
  }

  async getById(
    id: string,
    user?: JwtPayloadUser,
  ): Promise<LessonDetailResponseDto> {
    const lesson = await this.lessonsRepository.findById(id);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const canManage =
      !!user && this.canManageLessons(lesson.course.authorId, user);
    if (!lesson.isPublished && !canManage) {
      throw new NotFoundException('Lesson not found');
    }

    // Students get per-user stream links instead of the origin URLs.
    return toLessonDetail(lesson, {
      includeSourceUrls: canManage,
      ...(user
        ? {
            mediaToken: this.mediaTokenService.sign({
              userId: user.id,
              lessonId: lesson.id,
            }),
          }
        : {}),
    });
  }

  async create(
    courseId: string,
    dto: CreateLessonDto,
  ): Promise<LessonDetailResponseDto> {
    await this.ensureCourseExists(courseId);

    try {
      const lesson = await this.lessonsRepository.create({
        courseId,
        title: dto.title,
        content: dto.content ?? '',
        orderNumber: dto.orderNumber,
        ...(dto.isPublished !== undefined
          ? { isPublished: dto.isPublished }
          : {}),
      });
      this.lessonIndexService.scheduleReindex(lesson.id);
      return toLessonDetail(lesson);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(ErrorCode.LESSON_ORDER_CONFLICT);
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateLessonDto,
  ): Promise<LessonDetailResponseDto> {
    await this.ensureLessonExists(id);

    try {
      const lesson = await this.lessonsRepository.update(id, {
        title: dto.title,
        content: dto.content,
        orderNumber: dto.orderNumber,
        isPublished: dto.isPublished,
      });
      if (dto.title !== undefined || dto.content !== undefined) {
        this.lessonIndexService.scheduleReindex(id);
      }
      return toLessonDetail(lesson);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(ErrorCode.LESSON_ORDER_CONFLICT);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const lesson = await this.lessonsRepository.findById(id);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const publicIds =
      await this.lessonsRepository.findMediaPublicIdsByLessonId(id);
    await this.mediaService.deleteByPublicIds(
      publicIds.videoIds,
      UploadResourceType.VIDEO,
    );
    await this.mediaService.deleteByPublicIds(
      publicIds.rawIds,
      UploadResourceType.RAW,
    );
    this.lessonIndexService.scheduleDeleteLessonVectors(lesson.courseId, id);
    await this.lessonsRepository.delete(id);
  }

  async reorder(
    courseId: string,
    dto: ReorderLessonsDto,
  ): Promise<LessonSummaryResponseDto[]> {
    const lessons = await this.lessonsRepository.findByCourseId(courseId);
    if (!lessons.length) {
      throw new NotFoundException('Course not found or has no lessons');
    }

    const lessonIds = new Set(lessons.map((l) => l.id));
    const orderNumbers = new Set<number>();

    for (const item of dto.items) {
      if (!lessonIds.has(item.id)) {
        throw new BadRequestException(
          `Lesson ${item.id} does not belong to this course`,
        );
      }
      if (orderNumbers.has(item.orderNumber)) {
        throw new BadRequestException('orderNumber values must be unique');
      }
      orderNumbers.add(item.orderNumber);
    }

    await this.lessonsRepository.reorder(courseId, dto.items);
    const updated = await this.lessonsRepository.findByCourseId(courseId);
    return updated.map(toLessonSummary);
  }

  async attachVideo(
    lessonId: string,
    dto: AttachVideoDto,
  ): Promise<LessonVideoEntityDto> {
    const lesson = await this.ensureLessonExists(lessonId);

    if (dto.sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      throw new BadRequestException(ErrorCode.UPLOAD_LIMIT_EXCEEDED);
    }

    const orderNumber =
      dto.orderNumber ??
      (lesson.videos.length > 0
        ? Math.max(...lesson.videos.map((v) => v.orderNumber)) + 1
        : 1);

    const video = await this.lessonsRepository.attachVideo({
      lessonId,
      title: dto.title,
      source: VideoSource.CLOUDINARY,
      cloudinaryPublicId: dto.cloudinaryPublicId,
      url: dto.url,
      durationSeconds: dto.durationSeconds,
      sizeBytes: BigInt(dto.sizeBytes),
      orderNumber,
    });

    this.lessonIndexService.scheduleReindex(lessonId);

    return {
      lessonId: video.lessonId,
      ...(video.cloudinaryPublicId
        ? { cloudinaryPublicId: video.cloudinaryPublicId }
        : {}),
      ...toLessonVideo(video),
    };
  }

  async attachYoutubeVideo(
    lessonId: string,
    dto: AttachYoutubeVideoDto,
  ): Promise<LessonVideoEntityDto> {
    const lesson = await this.ensureLessonExists(lessonId);

    const parsed = parseYoutubeUrl(dto.youtubeUrl);
    if (!parsed) {
      throw new BadRequestException('Invalid YouTube URL');
    }

    const orderNumber =
      dto.orderNumber ??
      (lesson.videos.length > 0
        ? Math.max(...lesson.videos.map((v) => v.orderNumber)) + 1
        : 1);

    const video = await this.lessonsRepository.attachVideo({
      lessonId,
      title: dto.title,
      source: VideoSource.YOUTUBE,
      youtubeVideoId: parsed.videoId,
      url: parsed.watchUrl,
      durationSeconds: 0,
      orderNumber,
    });

    return {
      lessonId: video.lessonId,
      ...toLessonVideo(video),
    };
  }

  async updateVideo(
    id: string,
    dto: UpdateVideoDto,
  ): Promise<LessonVideoEntityDto> {
    const existing = await this.lessonsRepository.findVideoById(id);
    if (!existing) {
      throw new NotFoundException('Video not found');
    }

    const video = await this.lessonsRepository.updateVideo(id, {
      title: dto.title,
      orderNumber: dto.orderNumber,
    });

    return {
      lessonId: video.lessonId,
      ...(video.cloudinaryPublicId
        ? { cloudinaryPublicId: video.cloudinaryPublicId }
        : {}),
      ...toLessonVideo(video),
    };
  }

  async deleteVideo(id: string): Promise<void> {
    const video = await this.lessonsRepository.findVideoById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.source === VideoSource.CLOUDINARY && video.cloudinaryPublicId) {
      await this.mediaService.deleteByPublicIds(
        [video.cloudinaryPublicId],
        UploadResourceType.VIDEO,
      );
    }
    const lesson = await this.lessonsRepository.findById(video.lessonId);
    if (lesson) {
      this.lessonIndexService.scheduleCleanupMedia(
        lesson.courseId,
        video.lessonId,
        id,
      );
    }
    await this.lessonsRepository.deleteVideo(id);
  }

  async attachMaterial(
    lessonId: string,
    dto: AttachMaterialDto,
  ): Promise<LessonMaterialEntityDto> {
    await this.ensureLessonExists(lessonId);

    if (dto.sizeBytes > MAX_MATERIAL_SIZE_BYTES) {
      throw new BadRequestException(ErrorCode.UPLOAD_LIMIT_EXCEEDED);
    }

    const material = await this.lessonsRepository.attachMaterial({
      lessonId,
      title: dto.title,
      cloudinaryPublicId: dto.cloudinaryPublicId,
      url: dto.url,
      mimeType: dto.mimeType,
      sizeBytes: BigInt(dto.sizeBytes),
    });

    this.lessonIndexService.scheduleReindex(lessonId);

    return {
      lessonId: material.lessonId,
      cloudinaryPublicId: material.cloudinaryPublicId,
      createdAt: material.createdAt.toISOString(),
      ...toLessonMaterial(material),
    };
  }

  /** Streams an uploaded video to a viewer the guard already admitted. */
  async streamVideo(id: string, req: Request, res: Response): Promise<void> {
    const video = await this.lessonsRepository.findVideoById(id);
    if (!video || video.source !== VideoSource.CLOUDINARY) {
      throw new NotFoundException('Video not found');
    }
    const ext = extname(safeUrlPath(video.url)).toLowerCase();
    await this.mediaStreamService.stream(req, res, {
      storedUrl: video.url,
      publicId: video.cloudinaryPublicId,
      resourceType: UploadResourceType.VIDEO,
      mimeType: VIDEO_MIME_BY_EXT[ext] ?? 'video/mp4',
      filename: `${video.title}${ext}`,
    });
  }

  /** Serves a material inline (for the in-page viewer) to an admitted viewer. */
  async viewMaterial(id: string, req: Request, res: Response): Promise<void> {
    const material = await this.lessonsRepository.findMaterialById(id);
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    await this.mediaStreamService.stream(req, res, {
      storedUrl: material.url,
      publicId: material.cloudinaryPublicId,
      resourceType: UploadResourceType.RAW,
      mimeType: material.mimeType || 'application/octet-stream',
      filename: material.title,
    });
  }

  /** DOCX rendered to HTML so students can read it on the page without a download. */
  async renderMaterialHtml(id: string): Promise<{ html: string }> {
    const material = await this.lessonsRepository.findMaterialById(id);
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    if (!canRenderMaterialAsHtml(material.mimeType)) {
      throw new BadRequestException(ErrorCode.MATERIAL_PREVIEW_UNSUPPORTED);
    }

    const buffer = await this.fetchMaterialBytes(material);
    const result = await mammoth.convertToHtml({ buffer });
    return { html: result.value };
  }

  async downloadMaterial(id: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const material = await this.lessonsRepository.findMaterialById(id);
    if (!material) {
      throw new NotFoundException('Material not found');
    }

    const buffer = await this.fetchMaterialBytes(material);

    return {
      buffer,
      filename: material.title,
      mimeType: material.mimeType || 'application/octet-stream',
    };
  }

  /** Admin diagnostics: which delivery path works for this material's file. */
  async diagnoseMaterial(id: string): Promise<Record<string, string>> {
    const material = await this.lessonsRepository.findMaterialById(id);
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    return this.mediaService.diagnoseDelivery(
      material.cloudinaryPublicId,
      UploadResourceType.RAW,
      material.url,
      material.mimeType,
    );
  }

  /** The storage refused the file: say so (502 + reason) instead of a bare 500. */
  private async fetchMaterialBytes(material: {
    cloudinaryPublicId: string;
    url: string;
    mimeType: string;
  }): Promise<Buffer> {
    try {
      return await this.mediaService.downloadForIndexing(
        material.cloudinaryPublicId,
        UploadResourceType.RAW,
        material.url,
        material.mimeType,
      );
    } catch (error) {
      throw new BadGatewayException({
        statusCode: 502,
        message: ErrorCode.MEDIA_UNAVAILABLE,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteMaterial(id: string): Promise<void> {
    const material = await this.lessonsRepository.findMaterialById(id);
    if (!material) {
      throw new NotFoundException('Material not found');
    }

    await this.mediaService.deleteByPublicIds(
      [material.cloudinaryPublicId],
      UploadResourceType.RAW,
    );
    this.lessonIndexService.scheduleCleanupMedia(
      material.lesson.courseId,
      material.lessonId,
      id,
    );
    await this.lessonsRepository.deleteMaterial(id);
  }

  private async ensureCourseExists(courseId: string): Promise<void> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
  }

  private async ensureLessonExists(lessonId: string) {
    const lesson = await this.lessonsRepository.findById(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  private canManageLessons(authorId: string, user: JwtPayloadUser): boolean {
    return user.role === Role.ADMIN || authorId === user.id;
  }

  private assertCanViewCourse(
    status: CourseStatus,
    authorId: string,
    user: JwtPayloadUser | null,
  ): void {
    if (user && (user.role === Role.ADMIN || authorId === user.id)) {
      return;
    }
    if (status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Course not found');
    }
  }
}

function safeUrlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
