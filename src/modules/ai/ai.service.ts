import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LessonVectorIndexStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { LESSONS_REPOSITORY } from '../lessons/lessons.constants';
import type { ILessonsRepository } from '../lessons/lessons.repository.interface';
import { SELECTABLE_LLM_MODELS } from './ai.constants';
import { AuthorAiSettingsService } from './author-ai-settings.service';
import { GenerateLessonContentDto } from './dto/generate-lesson-content.dto';
import {
  LessonGenerationJobStatusDto,
  StartLessonGenerationResponseDto,
} from './dto/lesson-generation-job.dto';
import { LessonGenerationService } from './lesson-generation.service';
import { AiModelsResponseDto } from './dto/ai-model.dto';
import { LessonChatDto } from './dto/lesson-chat.dto';
import { LessonChatResponseDto } from './dto/lesson-chat-response.dto';
import { LlmUsageInfoDto } from './dto/llm-usage.dto';
import { LessonChatQuotaService } from './lesson-chat-quota.service';
import { RagClientService } from '../vector/rag-client.service';
import type { RagLlmUsageInfo } from '../vector/rag-client.types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly authorAiSettings: AuthorAiSettingsService,
    private readonly ragClient: RagClientService,
    private readonly lessonChatQuota: LessonChatQuotaService,
    private readonly lessonGeneration: LessonGenerationService,
    private readonly prisma: PrismaService,
    @Inject(LESSONS_REPOSITORY)
    private readonly lessonsRepository: ILessonsRepository,
  ) {}

  listModels(): AiModelsResponseDto {
    return { models: SELECTABLE_LLM_MODELS };
  }

  async startLessonGeneration(
    userId: string,
    lessonId: string,
    dto: GenerateLessonContentDto,
  ): Promise<StartLessonGenerationResponseDto> {
    const lesson = await this.lessonsRepository.findByIdWithCourse(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const apiKey = await this.authorAiSettings.getDecryptedKey(
      lesson.course.authorId,
    );
    if (!apiKey) {
      throw new BadRequestException(ErrorCode.AUTHOR_AI_KEY_REQUIRED);
    }

    await this.assertLessonIndexReady(lesson);

    return this.lessonGeneration.startGeneration(userId, lessonId, dto, lesson);
  }

  async getLatestLessonGenerationJob(
    userId: string,
    lessonId: string,
  ): Promise<LessonGenerationJobStatusDto | null> {
    const lesson = await this.lessonsRepository.findByIdWithCourse(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return this.lessonGeneration.getLatestJob(userId, lessonId);
  }

  async getLessonGenerationJob(
    userId: string,
    lessonId: string,
    jobId: string,
  ): Promise<LessonGenerationJobStatusDto> {
    const lesson = await this.lessonsRepository.findByIdWithCourse(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return this.lessonGeneration.getJob(userId, lessonId, jobId);
  }

  async chatOnLesson(
    userId: string,
    lessonId: string,
    dto: LessonChatDto,
  ): Promise<LessonChatResponseDto> {
    const quota = await this.lessonChatQuota.assertCanChat(userId);

    const lesson = await this.lessonsRepository.findByIdWithCourse(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const requestId = randomUUID();
    const response = await this.ragClient.askLesson(
      {
        question: dto.message.trim(),
        collection_name: `course_${lesson.course.id}`,
        metadata_filter: {
          lesson_id: lessonId,
          course_id: lesson.course.id,
        },
        top_k: 8,
      },
      requestId,
    );

    await this.lessonChatQuota.recordUsage(
      userId,
      response.usage?.total_tokens ?? 0,
    );

    return {
      answer: response.answer,
      usage: mapUsage(response.usage),
      remainingMessages: Math.max(0, quota.remaining - 1),
      requestId: response.request_id ?? requestId,
    };
  }

  private async assertLessonIndexReady(lesson: {
    id: string;
    vectorIndexStatus: LessonVectorIndexStatus;
    vectorIndexJobId: string | null;
  }): Promise<void> {
    if (
      lesson.vectorIndexStatus === LessonVectorIndexStatus.INDEXING ||
      lesson.vectorIndexStatus === LessonVectorIndexStatus.PENDING
    ) {
      throw new BadRequestException({
        message: ErrorCode.LESSON_INDEX_IN_PROGRESS,
      });
    }

    if (lesson.vectorIndexStatus === LessonVectorIndexStatus.FAILED) {
      const latestError = await this.prisma.lessonVectorIndexError.findFirst({
        where: {
          lessonId: lesson.id,
          ...(lesson.vectorIndexJobId
            ? { jobId: lesson.vectorIndexJobId }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      throw new BadRequestException({
        message: ErrorCode.LESSON_INDEX_FAILED,
        jobId: lesson.vectorIndexJobId,
        errorId: latestError?.id,
      });
    }

    if (lesson.vectorIndexStatus !== LessonVectorIndexStatus.READY) {
      throw new BadRequestException({
        message: ErrorCode.LESSON_INDEX_IN_PROGRESS,
      });
    }
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
