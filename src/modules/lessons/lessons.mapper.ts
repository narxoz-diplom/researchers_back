import { LessonVideo } from '@prisma/client';
import { LessonWithMedia } from './lessons.repository.interface';
import {
  LessonDetailResponseDto,
  LessonMaterialResponseDto,
  LessonSummaryResponseDto,
  LessonVideoResponseDto,
} from './dto/lesson-response.dto';

export function toLessonSummary(
  lesson: LessonWithMedia,
): LessonSummaryResponseDto {
  return {
    id: lesson.id,
    title: lesson.title,
    orderNumber: lesson.orderNumber,
  };
}

export function toLessonDetail(
  lesson: LessonWithMedia,
): LessonDetailResponseDto {
  const latestError = lesson.vectorIndexErrors?.[0];
  return {
    ...toLessonSummary(lesson),
    courseId: lesson.courseId,
    content: lesson.content,
    videos: lesson.videos.map(toLessonVideo),
    materials: lesson.materials.map(toLessonMaterial),
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
    vectorIndexStatus: lesson.vectorIndexStatus,
    vectorIndexJobId: lesson.vectorIndexJobId,
    vectorIndexedAt: lesson.vectorIndexedAt?.toISOString() ?? null,
    vectorIndexErrorId: latestError?.id ?? null,
    vectorIndexErrorCode: latestError?.errorCode ?? null,
  };
}

export function toLessonVideo(video: LessonVideo): LessonVideoResponseDto {
  return {
    id: video.id,
    title: video.title,
    url: video.url,
    durationSeconds: video.durationSeconds,
    orderNumber: video.orderNumber,
    sizeBytes: video.sizeBytes.toString(),
  };
}

export function toLessonMaterial(
  material: LessonWithMedia['materials'][number],
): LessonMaterialResponseDto {
  return {
    id: material.id,
    title: material.title,
    url: material.url,
    mimeType: material.mimeType,
    sizeBytes: material.sizeBytes.toString(),
  };
}
