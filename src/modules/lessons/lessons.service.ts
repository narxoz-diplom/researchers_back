import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, Prisma, Role } from '@prisma/client';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { COURSES_REPOSITORY } from '../courses/courses.constants';
import type { ICoursesRepository } from '../courses/courses.repository.interface';
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
  toLessonDetail,
  toLessonMaterial,
  toLessonSummary,
  toLessonVideo,
} from './lessons.mapper';

@Injectable()
export class LessonsService {
  constructor(
    @Inject(LESSONS_REPOSITORY)
    private readonly lessonsRepository: ILessonsRepository,
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: ICoursesRepository,
    private readonly mediaService: MediaService,
    private readonly lessonIndexService: LessonIndexService,
  ) {}

  async listByCourse(
    courseId: string,
    user: JwtPayloadUser,
  ): Promise<LessonSummaryResponseDto[]> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    this.assertCanViewCourse(course.status, course.authorId, user);

    const lessons = await this.lessonsRepository.findByCourseId(courseId);
    return lessons.map(toLessonSummary);
  }

  async getById(id: string): Promise<LessonDetailResponseDto> {
    const lesson = await this.lessonsRepository.findById(id);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return toLessonDetail(lesson);
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
      cloudinaryPublicId: dto.cloudinaryPublicId,
      url: dto.url,
      durationSeconds: dto.durationSeconds,
      sizeBytes: BigInt(dto.sizeBytes),
      orderNumber,
    });

    this.lessonIndexService.scheduleReindex(lessonId);

    return {
      lessonId: video.lessonId,
      cloudinaryPublicId: video.cloudinaryPublicId,
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
      cloudinaryPublicId: video.cloudinaryPublicId,
      ...toLessonVideo(video),
    };
  }

  async deleteVideo(id: string): Promise<void> {
    const video = await this.lessonsRepository.findVideoById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    await this.mediaService.deleteByPublicIds(
      [video.cloudinaryPublicId],
      UploadResourceType.VIDEO,
    );
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

  async downloadMaterial(id: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const material = await this.lessonsRepository.findMaterialById(id);
    if (!material) {
      throw new NotFoundException('Material not found');
    }

    const buffer = await this.mediaService.downloadForIndexing(
      material.cloudinaryPublicId,
      UploadResourceType.RAW,
      material.url,
      material.mimeType,
    );

    return {
      buffer,
      filename: material.title,
      mimeType: material.mimeType || 'application/octet-stream',
    };
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

  private assertCanViewCourse(
    status: CourseStatus,
    authorId: string,
    user: JwtPayloadUser,
  ): void {
    if (user.role === Role.ADMIN || authorId === user.id) {
      return;
    }
    if (status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Course not found');
    }
  }
}
