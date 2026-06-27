import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LessonGenerationJobStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_LLM_MODEL_ID, DEFAULT_PRO_LLM_MODEL_ID } from './ai.constants';
import { AuthorAiSettingsService } from './author-ai-settings.service';
import { GenerateLessonContentDto } from './dto/generate-lesson-content.dto';
import {
  LessonGenerationJobStatusDto,
  StartLessonGenerationResponseDto,
} from './dto/lesson-generation-job.dto';
import { LlmUsageInfoDto } from './dto/llm-usage.dto';
import { RagClientService } from '../vector/rag-client.service';
import type {
  RagAsyncTaskResponse,
  RagGenerateSingleLessonResponse,
  RagLlmUsageInfo,
} from '../vector/rag-client.types';

interface RagGenerationCallbackPayload {
  task_id?: string;
  status: 'completed' | 'failed' | 'processing';
  result?: RagGenerateSingleLessonResponse;
  error?: string;
}

@Injectable()
export class LessonGenerationService {
  private readonly logger = new Logger(LessonGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly authorAiSettings: AuthorAiSettingsService,
    private readonly ragClient: RagClientService,
  ) {}

  async startGeneration(
    authorId: string,
    lessonId: string,
    dto: GenerateLessonContentDto,
    lesson: {
      id: string;
      title: string;
      content: string | null;
      course: { id: string; authorId: string };
    },
  ): Promise<StartLessonGenerationResponseDto> {
    const apiKey = await this.authorAiSettings.getDecryptedKey(
      lesson.course.authorId,
    );
    if (!apiKey) {
      throw new BadRequestException(ErrorCode.AUTHOR_AI_KEY_REQUIRED);
    }

    const requestId = randomUUID();
    const ragPayload = this.buildRagPayload(lessonId, lesson, dto, apiKey);

    const job = await this.prisma.lessonGenerationJob.create({
      data: {
        lessonId,
        authorId,
        status: LessonGenerationJobStatus.PROCESSING,
        generationPhase: dto.phase ?? 'content',
        outputFormat: dto.outputFormat ?? 'lecture',
      },
    });

    const callbackUrl = this.buildCallbackUrl(job.id);

    this.logger.log(
      `startGeneration jobId=${job.id} lessonId=${lessonId} requestId=${requestId} model=${ragPayload.llm_model_id}`,
    );

    try {
      const ack = (await this.ragClient.generateSingleLesson(
        {
          ...ragPayload,
          callback_url: callbackUrl,
        },
        requestId,
      )) as RagAsyncTaskResponse;

      await this.prisma.lessonGenerationJob.update({
        where: { id: job.id },
        data: {
          ragRequestId: ack.request_id ?? requestId,
          ragTaskId: ack.task_id,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.lessonGenerationJob.update({
        where: { id: job.id },
        data: {
          status: LessonGenerationJobStatus.FAILED,
          errorCode: ErrorCode.AI_SERVICE_UNAVAILABLE,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      throw error;
    }

    return { jobId: job.id, status: 'processing' };
  }

  async getLatestJob(
    authorId: string,
    lessonId: string,
  ): Promise<LessonGenerationJobStatusDto | null> {
    const job = await this.prisma.lessonGenerationJob.findFirst({
      where: { lessonId, authorId },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) {
      return null;
    }

    return this.toStatusDto(job);
  }

  async getJob(
    authorId: string,
    lessonId: string,
    jobId: string,
  ): Promise<LessonGenerationJobStatusDto> {
    const job = await this.prisma.lessonGenerationJob.findFirst({
      where: { id: jobId, lessonId, authorId },
    });
    if (!job) {
      throw new NotFoundException('Generation job not found');
    }

    return this.toStatusDto(job);
  }

  async handleRagCallback(params: {
    jobId: string;
    payload: RagGenerationCallbackPayload;
  }): Promise<void> {
    if (params.payload.status === 'processing') {
      return;
    }

    const job = await this.prisma.lessonGenerationJob.findUnique({
      where: { id: params.jobId },
      include: {
        lesson: { select: { title: true } },
      },
    });
    if (!job || job.status !== LessonGenerationJobStatus.PROCESSING) {
      this.logger.warn(
        `Ignoring stale generation callback jobId=${params.jobId}`,
      );
      return;
    }

    if (params.payload.status === 'failed') {
      const errorMessage =
        params.payload.error?.trim() || 'RAG generation task failed.';
      await this.prisma.lessonGenerationJob.update({
        where: { id: job.id },
        data: {
          status: LessonGenerationJobStatus.FAILED,
          errorCode: this.mapErrorCode(errorMessage),
          errorMessage,
          ragTaskId: params.payload.task_id ?? job.ragTaskId,
          completedAt: new Date(),
        },
      });
      return;
    }

    const result = params.payload.result;
    const generated = result?.lessons?.[0];
    if (!generated?.content?.trim()) {
      await this.prisma.lessonGenerationJob.update({
        where: { id: job.id },
        data: {
          status: LessonGenerationJobStatus.FAILED,
          errorCode: ErrorCode.AI_SERVICE_UNAVAILABLE,
          errorMessage: 'RAG returned empty lesson content.',
          ragTaskId: params.payload.task_id ?? job.ragTaskId,
          ragRequestId: result?.request_id ?? job.ragRequestId,
          completedAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.lessonGenerationJob.update({
      where: { id: job.id },
      data: {
        status: LessonGenerationJobStatus.COMPLETED,
        content: generated.content,
        title: generated.title || job.lesson.title,
        usageJson: (result?.usage ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ragTaskId: params.payload.task_id ?? job.ragTaskId,
        ragRequestId: result?.request_id ?? job.ragRequestId,
        completedAt: new Date(),
      },
    });
  }

  private buildRagPayload(
    lessonId: string,
    lesson: {
      title: string;
      content: string | null;
      course: { id: string };
    },
    dto: GenerateLessonContentDto,
    apiKey: string,
  ) {
    const brief = dto.brief.trim();
    const targetAudience = dto.targetAudience ?? 'bachelor';
    const depth = dto.depth ?? 'medium';
    const outputFormat = dto.outputFormat ?? 'lecture';
    const phase = dto.phase ?? 'content';
    const approvedOutline = dto.approvedOutline?.trim() ?? '';
    const llmModelId =
      dto.llmModelId ||
      (targetAudience === 'pro'
        ? DEFAULT_PRO_LLM_MODEL_ID
        : DEFAULT_LLM_MODEL_ID);
    const topK = depth === 'deep' ? 32 : 24;
    const teacherBrief = brief;
    const lessonContentSnippet = lesson.content?.trim().slice(0, 500) ?? '';
    const summary = [brief, lessonContentSnippet].filter(Boolean).join('\n\n');
    const retrievalQuery = [lesson.title, brief, lessonContentSnippet]
      .filter(Boolean)
      .join('\n');

    return {
      collection_name: `course_${lesson.course.id}`,
      title: lesson.title,
      summary,
      lesson_index: 1,
      total_lessons: 1,
      top_k: topK,
      llm_model_id: llmModelId,
      gemini_api_key: apiKey,
      metadata_filter: {
        course_id: lesson.course.id,
        lesson_id: lessonId,
      },
      params: {
        teacher_brief: teacherBrief,
        output_language: dto.language,
        target_audience: targetAudience,
        depth,
        output_format: outputFormat,
        generation_phase: phase,
        approved_outline: approvedOutline,
        retrieval_mode: 'semantic',
        retrieval_query: retrievalQuery,
      },
    };
  }

  private buildCallbackUrl(jobId: string): string {
    const base = this.getPublicApiUrl();
    const secret = this.getCallbackSecret();
    const params = new URLSearchParams({ jobId, secret });
    return `${base}/api/v1/rag/generation-callback?${params.toString()}`;
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

  private mapErrorCode(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('valid api key') || lower.includes('author google ai')) {
      return ErrorCode.AUTHOR_AI_KEY_INVALID;
    }
    return ErrorCode.AI_SERVICE_UNAVAILABLE;
  }

  private toStatusDto(job: {
    id: string;
    status: LessonGenerationJobStatus;
    content: string | null;
    title: string | null;
    usageJson: unknown;
    errorCode: string | null;
    errorMessage: string | null;
    ragRequestId: string | null;
    generationPhase: string | null;
    outputFormat: string | null;
  }): LessonGenerationJobStatusDto {
    const status =
      job.status === LessonGenerationJobStatus.PROCESSING
        ? 'processing'
        : job.status === LessonGenerationJobStatus.COMPLETED
          ? 'completed'
          : 'failed';

    return {
      jobId: job.id,
      status,
      content: job.content ?? undefined,
      title: job.title ?? undefined,
      usage: mapUsage(job.usageJson as RagLlmUsageInfo | null),
      errorCode: job.errorCode ?? undefined,
      errorMessage: job.errorMessage ?? undefined,
      requestId: job.ragRequestId ?? undefined,
      generationPhase:
        job.generationPhase === 'outline' || job.generationPhase === 'content'
          ? job.generationPhase
          : undefined,
      outputFormat: job.outputFormat ?? undefined,
    };
  }
}

function mapUsage(usage?: RagLlmUsageInfo | null): LlmUsageInfoDto | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    llmModelId: usage.llm_model_id,
    provider: usage.provider,
    providerModelId: usage.provider_model_id,
    inputTokens: usage.input_tokens ?? undefined,
    outputTokens: usage.output_tokens ?? undefined,
    totalTokens: usage.total_tokens ?? undefined,
    usageSource: usage.usage_source,
  };
}
