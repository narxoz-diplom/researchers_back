import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LessonIndexTaskStatus, LessonVectorIndexStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LessonIndexErrorCode } from './lesson-index.constants';
import { LessonIndexNotificationService } from './lesson-index-notification.service';
import { MediaService } from '../media/media.service';
import { UploadResourceType } from '../media/media.types';
import { AuthorAiSettingsService } from '../ai/author-ai-settings.service';
import { RagClientService } from './rag-client.service';
import { VectorIndexService } from './vector-index.service';

interface RagCallbackPayload {
  task_id?: string;
  status: 'completed' | 'failed' | 'processing';
  result?: { request_id?: string | null };
  error?: string;
}

@Injectable()
export class LessonIndexService {
  private readonly logger = new Logger(LessonIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly ragClient: RagClientService,
    private readonly vectorIndex: VectorIndexService,
    private readonly notifications: LessonIndexNotificationService,
    private readonly mediaService: MediaService,
    private readonly authorAiSettings: AuthorAiSettingsService,
  ) {}

  scheduleReindex(lessonId: string): void {
    void this.runReindex(lessonId).catch((error: unknown) => {
      this.logger.warn(
        `Lesson reindex scheduling failed lessonId=${lessonId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  scheduleDeleteLessonVectors(courseId: string, lessonId: string): void {
    this.vectorIndex.scheduleDeleteLessonVectors(courseId, lessonId);
  }

  scheduleDeleteCourseVectors(courseId: string): void {
    this.vectorIndex.scheduleDeleteCourseVectors(courseId);
  }

  scheduleCleanupMedia(
    courseId: string,
    lessonId: string,
    fileId: string,
  ): void {
    const requestId = randomUUID();
    void this.ragClient
      .cleanupMedia(courseId, lessonId, fileId, requestId)
      .catch((error: unknown) => {
        this.logger.warn(
          `Media vector cleanup failed lessonId=${lessonId} fileId=${fileId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  async handleRagCallback(params: {
    jobId: string;
    taskKey: string;
    payload: RagCallbackPayload;
  }): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { vectorIndexJobId: params.jobId },
      include: {
        course: { select: { authorId: true } },
      },
    });
    if (!lesson) {
      this.logger.warn(
        `Ignoring stale RAG callback jobId=${params.jobId} taskKey=${params.taskKey}`,
      );
      return;
    }

    const task = await this.prisma.lessonIndexTask.findUnique({
      where: {
        jobId_taskKey: {
          jobId: params.jobId,
          taskKey: params.taskKey,
        },
      },
    });
    if (!task || task.status !== LessonIndexTaskStatus.PENDING) {
      return;
    }

    if (params.payload.status === 'completed') {
      await this.prisma.lessonIndexTask.update({
        where: { id: task.id },
        data: { status: LessonIndexTaskStatus.COMPLETED },
      });
      await this.tryFinalizeJob(params.jobId, lesson.id);
      return;
    }

    if (params.payload.status === 'failed') {
      const message =
        params.payload.error?.trim() || 'RAG indexing task failed.';
      await this.markJobFailed({
        lessonId: lesson.id,
        jobId: params.jobId,
        taskKey: params.taskKey,
        errorCode: LessonIndexErrorCode.RAG_CALLBACK_FAILED,
        message,
        ragRequestId:
          params.payload.result?.request_id ?? params.payload.task_id,
      });
    }
  }

  private async runReindex(lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        videos: { orderBy: { orderNumber: 'asc' } },
        materials: true,
        course: {
          select: {
            id: true,
            authorId: true,
            author: { select: { email: true, fullName: true } },
          },
        },
      },
    });
    if (!lesson) {
      return;
    }

    const authorApiKey = await this.authorAiSettings.getDecryptedKey(
      lesson.course.authorId,
    );
    if (!authorApiKey) {
      this.logger.warn(
        `Lesson reindex skipped: author has no AI key lessonId=${lessonId}`,
      );
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: { vectorIndexStatus: LessonVectorIndexStatus.FAILED },
      });
      return;
    }

    const taskKeys: string[] = [];
    const hasText =
      lesson.title.trim().length > 0 || lesson.content.trim().length > 0;
    if (hasText) {
      taskKeys.push('text');
    }
    for (const video of lesson.videos) {
      taskKeys.push(`video:${video.id}`);
    }
    for (const material of lesson.materials) {
      taskKeys.push(`material:${material.id}`);
    }

    if (taskKeys.length === 0) {
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          vectorIndexStatus: LessonVectorIndexStatus.READY,
          vectorIndexJobId: null,
          vectorIndexedAt: new Date(),
        },
      });
      return;
    }

    const job = await this.prisma.lessonIndexJob.create({
      data: {
        lessonId,
        tasks: {
          create: taskKeys.map((taskKey) => ({ taskKey })),
        },
      },
    });

    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        vectorIndexStatus: LessonVectorIndexStatus.INDEXING,
        vectorIndexJobId: job.id,
      },
    });

    const collectionName = `course_${lesson.courseId}`;
    const dispatchErrors: Array<{
      taskKey: string;
      message: string;
      errorCode: string;
    }> = [];

    for (const taskKey of taskKeys) {
      const callbackUrl = this.buildCallbackUrl(job.id, taskKey);
      const requestId = randomUUID();

      try {
        if (taskKey === 'text') {
          await this.ragClient.vectorizeLesson(
            {
              text: `# ${lesson.title}\n\n${lesson.content}`.trim(),
              collection_name: collectionName,
              metadata: {
                course_id: lesson.courseId,
                lesson_id: lesson.id,
                content_type: 'lesson_text',
              },
              callback_url: callbackUrl,
              gemini_api_key: authorApiKey,
            },
            requestId,
          );
          continue;
        }

        if (taskKey.startsWith('video:')) {
          const videoId = taskKey.slice('video:'.length);
          const video = lesson.videos.find((v) => v.id === videoId);
          if (!video?.cloudinaryPublicId) {
            continue;
          }
          const buffer = await this.mediaService.downloadForIndexing(
            video.cloudinaryPublicId,
            UploadResourceType.VIDEO,
            video.url,
          );
          const filename = this.ingestFilename('video');
          await this.ragClient.ingestFile(
            {
              buffer,
              filename,
              collectionName,
              callbackUrl,
              geminiApiKey: authorApiKey,
              metadata: {
                course_id: lesson.courseId,
                lesson_id: lesson.id,
                content_type: 'lesson_media',
                file_id: video.id,
                media_kind: 'video',
              },
            },
            requestId,
          );
          continue;
        }

        if (taskKey.startsWith('material:')) {
          const materialId = taskKey.slice('material:'.length);
          const material = lesson.materials.find((m) => m.id === materialId);
          if (!material) {
            continue;
          }
          const buffer = await this.mediaService.downloadForIndexing(
            material.cloudinaryPublicId,
            UploadResourceType.RAW,
            material.url,
            material.mimeType,
          );
          const filename = this.ingestFilename('material', material.mimeType);
          await this.ragClient.ingestFile(
            {
              buffer,
              filename,
              collectionName,
              callbackUrl,
              geminiApiKey: authorApiKey,
              metadata: {
                course_id: lesson.courseId,
                lesson_id: lesson.id,
                content_type: 'lesson_media',
                file_id: material.id,
                media_kind: 'material',
              },
            },
            requestId,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatchErrors.push({
          taskKey,
          message,
          errorCode: message.includes('Failed to download media')
            ? LessonIndexErrorCode.MEDIA_DOWNLOAD_FAILED
            : LessonIndexErrorCode.RAG_UNAVAILABLE,
        });
      }
    }

    if (dispatchErrors.length > 0) {
      const first = dispatchErrors[0];
      await this.markJobFailed({
        lessonId: lesson.id,
        jobId: job.id,
        taskKey: first.taskKey,
        errorCode: first.errorCode,
        message: first.message,
      });
    }
  }

  private buildCallbackUrl(jobId: string, taskKey: string): string {
    const base = this.getPublicApiUrl();
    const secret = this.getCallbackSecret();
    const params = new URLSearchParams({
      jobId,
      taskKey,
      secret,
    });
    return `${base}/api/v1/rag/index-callback?${params.toString()}`;
  }

  private getPublicApiUrl(): string {
    const raw = this.configService.get<string>('PUBLIC_API_URL')?.trim();
    if (raw) {
      return raw.replace(/\/+$/, '');
    }
    const port = this.configService.get<string>('PORT')?.trim() || '8080';
    return `http://localhost:${port}`;
  }

  private getCallbackSecret(): string {
    const secret = this.configService
      .get<string>('RAG_CALLBACK_SECRET')
      ?.trim();
    if (!secret) {
      throw new Error('RAG_CALLBACK_SECRET is not configured');
    }
    return secret;
  }

  /** Neutral filename for RAG ingest only (type detection). Not shown to the LLM. */
  private ingestFilename(
    mediaKind: 'video' | 'material',
    mimeType?: string,
  ): string {
    if (mediaKind === 'video') {
      return 'video.mp4';
    }
    const byMime: Record<string, string> = {
      'application/pdf': 'document.pdf',
      'application/msword': 'document.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'document.docx',
    };
    return byMime[mimeType ?? ''] ?? 'document.bin';
  }

  private async tryFinalizeJob(jobId: string, lessonId: string): Promise<void> {
    const tasks = await this.prisma.lessonIndexTask.findMany({
      where: { jobId },
    });
    const allCompleted = tasks.every(
      (task) => task.status === LessonIndexTaskStatus.COMPLETED,
    );
    if (!allCompleted) {
      return;
    }

    await this.prisma.lesson.updateMany({
      where: { id: lessonId, vectorIndexJobId: jobId },
      data: {
        vectorIndexStatus: LessonVectorIndexStatus.READY,
        vectorIndexedAt: new Date(),
      },
    });
  }

  private async markJobFailed(params: {
    lessonId: string;
    jobId: string;
    taskKey: string;
    errorCode: string;
    message: string;
    ragRequestId?: string | null;
  }): Promise<void> {
    await this.prisma.lessonIndexTask.updateMany({
      where: { jobId: params.jobId, taskKey: params.taskKey },
      data: { status: LessonIndexTaskStatus.FAILED },
    });

    const errorRecord = await this.prisma.lessonVectorIndexError.create({
      data: {
        lessonId: params.lessonId,
        jobId: params.jobId,
        errorCode: params.errorCode,
        message: params.message,
        source: params.taskKey,
        ragRequestId: params.ragRequestId ?? null,
      },
    });

    await this.prisma.lesson.updateMany({
      where: { id: params.lessonId, vectorIndexJobId: params.jobId },
      data: { vectorIndexStatus: LessonVectorIndexStatus.FAILED },
    });

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        course: {
          select: {
            author: { select: { email: true, fullName: true } },
          },
        },
      },
    });
    if (!lesson) {
      return;
    }

    void this.notifications.notifyIndexFailed({
      errorId: errorRecord.id,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      jobId: params.jobId,
      authorEmail: lesson.course.author.email,
      authorName: lesson.course.author.fullName,
    });
  }
}
