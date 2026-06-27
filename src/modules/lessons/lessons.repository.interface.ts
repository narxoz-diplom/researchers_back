import { Prisma } from '@prisma/client';

export interface CreateLessonPayload {
  courseId: string;
  title: string;
  content: string;
  orderNumber: number;
}

export interface UpdateLessonPayload {
  title?: string;
  content?: string;
  orderNumber?: number;
}

export interface ReorderItemPayload {
  id: string;
  orderNumber: number;
}

export interface AttachVideoPayload {
  lessonId: string;
  title: string;
  cloudinaryPublicId: string;
  url: string;
  durationSeconds: number;
  sizeBytes: bigint;
  orderNumber: number;
}

export interface UpdateVideoPayload {
  title?: string;
  orderNumber?: number;
}

export interface AttachMaterialPayload {
  lessonId: string;
  title: string;
  cloudinaryPublicId: string;
  url: string;
  mimeType: string;
  sizeBytes: bigint;
}

export type LessonWithCourse = Prisma.LessonGetPayload<{
  include: {
    course: { select: { id: true; authorId: true; status: true } };
  };
}>;

export type LessonWithMedia = Prisma.LessonGetPayload<{
  include: {
    course: { select: { id: true; authorId: true; status: true } };
    videos: { orderBy: { orderNumber: 'asc' } };
    materials: true;
    vectorIndexErrors: { orderBy: { createdAt: 'desc' }; take: 1 };
  };
}>;

export type VideoWithLesson = Prisma.LessonVideoGetPayload<{
  include: {
    lesson: {
      include: { course: { select: { id: true; authorId: true } } };
    };
  };
}>;

export type MaterialWithLesson = Prisma.LessonMaterialGetPayload<{
  include: {
    lesson: {
      include: { course: { select: { id: true; authorId: true } } };
    };
  };
}>;

export interface ILessonsRepository {
  findByCourseId(courseId: string): Promise<LessonWithMedia[]>;
  findByIdWithCourse(id: string): Promise<LessonWithMedia | null>;
  findById(id: string): Promise<LessonWithMedia | null>;
  create(payload: CreateLessonPayload): Promise<LessonWithMedia>;
  update(id: string, payload: UpdateLessonPayload): Promise<LessonWithMedia>;
  delete(id: string): Promise<void>;
  reorder(courseId: string, items: ReorderItemPayload[]): Promise<void>;
  findMediaPublicIdsByLessonId(
    lessonId: string,
  ): Promise<{ videoIds: string[]; rawIds: string[] }>;
  attachVideo(payload: AttachVideoPayload): Promise<VideoWithLesson>;
  findVideoById(id: string): Promise<VideoWithLesson | null>;
  updateVideo(
    id: string,
    payload: UpdateVideoPayload,
  ): Promise<VideoWithLesson>;
  deleteVideo(id: string): Promise<void>;
  attachMaterial(payload: AttachMaterialPayload): Promise<MaterialWithLesson>;
  findMaterialById(id: string): Promise<MaterialWithLesson | null>;
  deleteMaterial(id: string): Promise<void>;
}
