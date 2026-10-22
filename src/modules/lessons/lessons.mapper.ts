import { LessonVideo, VideoSource } from '@prisma/client';
import { LessonWithMedia } from './lessons.repository.interface';
import {
  LessonDetailResponseDto,
  LessonMaterialResponseDto,
  LessonSummaryResponseDto,
  LessonVideoResponseDto,
} from './dto/lesson-response.dto';

export interface LessonMediaOptions {
  /** Origin URLs (Cloudinary, YouTube watch link) go only to the course author and admins. */
  includeSourceUrls: boolean;
  /** Token the lesson endpoint issued to this viewer; builds the per-user stream links. */
  mediaToken?: string;
}

const MANAGER_OPTIONS: LessonMediaOptions = { includeSourceUrls: true };

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Formats the API can render as HTML for in-page reading. */
export function canRenderMaterialAsHtml(mimeType: string): boolean {
  return mimeType === DOCX_MIME;
}

export function toLessonSummary(
  lesson: LessonWithMedia,
): LessonSummaryResponseDto {
  return {
    id: lesson.id,
    title: lesson.title,
    orderNumber: lesson.orderNumber,
    isPublished: lesson.isPublished,
  };
}

export function toLessonDetail(
  lesson: LessonWithMedia,
  options: LessonMediaOptions = MANAGER_OPTIONS,
): LessonDetailResponseDto {
  const latestError = lesson.vectorIndexErrors?.[0];
  return {
    ...toLessonSummary(lesson),
    courseId: lesson.courseId,
    content: lesson.content,
    videos: lesson.videos.map((video) => toLessonVideo(video, options)),
    materials: lesson.materials.map((material) =>
      toLessonMaterial(material, options),
    ),
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
    vectorIndexStatus: lesson.vectorIndexStatus,
    vectorIndexJobId: lesson.vectorIndexJobId,
    vectorIndexedAt: lesson.vectorIndexedAt?.toISOString() ?? null,
    vectorIndexErrorId: latestError?.id ?? null,
    vectorIndexErrorCode: latestError?.errorCode ?? null,
  };
}

export function toLessonVideo(
  video: LessonVideo,
  options: LessonMediaOptions = MANAGER_OPTIONS,
): LessonVideoResponseDto {
  const streamable =
    video.source === VideoSource.CLOUDINARY && options.mediaToken;
  return {
    id: video.id,
    title: video.title,
    source: video.source,
    ...(options.includeSourceUrls ? { url: video.url } : {}),
    ...(streamable
      ? {
          streamUrl: `/videos/${video.id}/stream?t=${encodeURIComponent(options.mediaToken!)}`,
        }
      : {}),
    ...(video.youtubeVideoId ? { youtubeVideoId: video.youtubeVideoId } : {}),
    durationSeconds: video.durationSeconds,
    orderNumber: video.orderNumber,
    ...(video.sizeBytes != null
      ? { sizeBytes: video.sizeBytes.toString() }
      : {}),
  };
}

export function toLessonMaterial(
  material: LessonWithMedia['materials'][number],
  options: LessonMediaOptions = MANAGER_OPTIONS,
): LessonMaterialResponseDto {
  return {
    id: material.id,
    title: material.title,
    ...(options.includeSourceUrls ? { url: material.url } : {}),
    viewUrl: `/materials/${material.id}/view`,
    ...(canRenderMaterialAsHtml(material.mimeType)
      ? { htmlUrl: `/materials/${material.id}/html` }
      : {}),
    mimeType: material.mimeType,
    sizeBytes: material.sizeBytes.toString(),
  };
}
