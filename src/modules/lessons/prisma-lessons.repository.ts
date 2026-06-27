import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AttachMaterialPayload,
  AttachVideoPayload,
  CreateLessonPayload,
  ILessonsRepository,
  LessonWithMedia,
  MaterialWithLesson,
  ReorderItemPayload,
  UpdateLessonPayload,
  UpdateVideoPayload,
  VideoWithLesson,
} from './lessons.repository.interface';

const lessonInclude = {
  course: { select: { id: true, authorId: true, status: true } },
  videos: { orderBy: { orderNumber: 'asc' as const } },
  materials: true,
  vectorIndexErrors: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.LessonInclude;

@Injectable()
export class PrismaLessonsRepository implements ILessonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCourseId(courseId: string): Promise<LessonWithMedia[]> {
    return this.prisma.lesson.findMany({
      where: { courseId },
      include: lessonInclude,
      orderBy: { orderNumber: 'asc' },
    });
  }

  findByIdWithCourse(id: string): Promise<LessonWithMedia | null> {
    return this.findById(id);
  }

  findById(id: string): Promise<LessonWithMedia | null> {
    return this.prisma.lesson.findUnique({
      where: { id },
      include: lessonInclude,
    });
  }

  create(payload: CreateLessonPayload): Promise<LessonWithMedia> {
    return this.prisma.lesson.create({
      data: payload,
      include: lessonInclude,
    });
  }

  update(id: string, payload: UpdateLessonPayload): Promise<LessonWithMedia> {
    return this.prisma.lesson.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.content !== undefined ? { content: payload.content } : {}),
        ...(payload.orderNumber !== undefined
          ? { orderNumber: payload.orderNumber }
          : {}),
      },
      include: lessonInclude,
    });
  }

  delete(id: string): Promise<void> {
    return this.prisma.lesson.delete({ where: { id } }).then(() => undefined);
  }

  async reorder(courseId: string, items: ReorderItemPayload[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const offset = 10_000;
      for (const item of items) {
        await tx.lesson.update({
          where: { id: item.id, courseId },
          data: { orderNumber: item.orderNumber + offset },
        });
      }
      for (const item of items) {
        await tx.lesson.update({
          where: { id: item.id, courseId },
          data: { orderNumber: item.orderNumber },
        });
      }
    });
  }

  async findMediaPublicIdsByLessonId(
    lessonId: string,
  ): Promise<{ videoIds: string[]; rawIds: string[] }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { videos: true, materials: true },
    });
    if (!lesson) {
      return { videoIds: [], rawIds: [] };
    }
    return {
      videoIds: lesson.videos.map((v) => v.cloudinaryPublicId),
      rawIds: lesson.materials.map((m) => m.cloudinaryPublicId),
    };
  }

  attachVideo(payload: AttachVideoPayload): Promise<VideoWithLesson> {
    return this.prisma.lessonVideo.create({
      data: payload,
      include: {
        lesson: {
          include: { course: { select: { id: true, authorId: true } } },
        },
      },
    });
  }

  findVideoById(id: string): Promise<VideoWithLesson | null> {
    return this.prisma.lessonVideo.findUnique({
      where: { id },
      include: {
        lesson: {
          include: { course: { select: { id: true, authorId: true } } },
        },
      },
    });
  }

  updateVideo(
    id: string,
    payload: UpdateVideoPayload,
  ): Promise<VideoWithLesson> {
    return this.prisma.lessonVideo.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.orderNumber !== undefined
          ? { orderNumber: payload.orderNumber }
          : {}),
      },
      include: {
        lesson: {
          include: { course: { select: { id: true, authorId: true } } },
        },
      },
    });
  }

  deleteVideo(id: string): Promise<void> {
    return this.prisma.lessonVideo
      .delete({ where: { id } })
      .then(() => undefined);
  }

  attachMaterial(payload: AttachMaterialPayload): Promise<MaterialWithLesson> {
    return this.prisma.lessonMaterial.create({
      data: payload,
      include: {
        lesson: {
          include: { course: { select: { id: true, authorId: true } } },
        },
      },
    });
  }

  findMaterialById(id: string): Promise<MaterialWithLesson | null> {
    return this.prisma.lessonMaterial.findUnique({
      where: { id },
      include: {
        lesson: {
          include: { course: { select: { id: true, authorId: true } } },
        },
      },
    });
  }

  deleteMaterial(id: string): Promise<void> {
    return this.prisma.lessonMaterial
      .delete({ where: { id } })
      .then(() => undefined);
  }
}
