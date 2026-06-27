import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ErrorCode } from '../../common/errors/error-codes';
import type {
  RagAskRequest,
  RagAskResponse,
  RagAsyncTaskResponse,
  RagGenerateSingleLessonRequest,
  RagGenerateSingleLessonResponse,
  RagIngestFileInput,
  RagIngestResponse,
  RagVectorCleanupRequest,
  RagVectorCleanupResponse,
  RagVectorizeTextRequest,
  RagVectorizeTextResponse,
} from './rag-client.types';

const RAG_TIMEOUT_MS = 60_000;
const RAG_GENERATION_TIMEOUT_MS = 180_000;
const RAG_INGEST_SUBMIT_TIMEOUT_MS = 120_000;

@Injectable()
export class RagClientService {
  private readonly logger = new Logger(RagClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateSingleLesson(
    payload: RagGenerateSingleLessonRequest,
    requestId = randomUUID(),
  ): Promise<RagGenerateSingleLessonResponse | RagAsyncTaskResponse> {
    const timeoutMs = payload.callback_url
      ? RAG_INGEST_SUBMIT_TIMEOUT_MS
      : RAG_GENERATION_TIMEOUT_MS;

    return this.post<RagGenerateSingleLessonResponse | RagAsyncTaskResponse>(
      '/generate-single-lesson-lms',
      payload,
      requestId,
      timeoutMs,
    );
  }

  async askLesson(
    payload: RagAskRequest,
    requestId = randomUUID(),
  ): Promise<RagAskResponse> {
    return this.post<RagAskResponse>('/ask', payload, requestId);
  }

  async vectorizeLesson(
    payload: RagVectorizeTextRequest,
    requestId = randomUUID(),
  ): Promise<RagVectorizeTextResponse> {
    return this.post<RagVectorizeTextResponse>(
      '/vectorize-text',
      payload,
      requestId,
    );
  }

  async cleanupMedia(
    courseId: string,
    lessonId: string,
    fileId: string,
    requestId = randomUUID(),
  ): Promise<RagVectorCleanupResponse> {
    return this.cleanupVectors(
      {
        eventType: 'MEDIA_DELETED',
        courseId,
        lessonId,
        fileId,
        collectionName: `course_${courseId}`,
      },
      requestId,
    );
  }

  async ingestFile(
    input: RagIngestFileInput,
    requestId = randomUUID(),
  ): Promise<RagIngestResponse | RagAsyncTaskResponse> {
    const url = `${this.getBaseUrl()}/api/v1/ingest`;
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.buffer)]);
    form.append('file', blob, input.filename);
    form.append('metadata', JSON.stringify(input.metadata));
    form.append('collection_name', input.collectionName);
    if (input.callbackUrl) {
      form.append('callback_url', input.callbackUrl);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.getApiKey(),
          'X-Request-ID': requestId,
        },
        body: form,
        signal: AbortSignal.timeout(RAG_INGEST_SUBMIT_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.warn(
          `RAG /ingest failed status=${response.status} requestId=${requestId} body=${errorBody.slice(0, 500)}`,
        );
        throw new InternalServerErrorException(
          ErrorCode.AI_SERVICE_UNAVAILABLE,
        );
      }

      return (await response.json()) as
        | RagIngestResponse
        | RagAsyncTaskResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.warn(
        `RAG /ingest unreachable requestId=${requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(ErrorCode.AI_SERVICE_UNAVAILABLE);
    }
  }

  async cleanupVectors(
    payload: RagVectorCleanupRequest,
    requestId = randomUUID(),
  ): Promise<RagVectorCleanupResponse> {
    return this.post<RagVectorCleanupResponse>(
      '/vector-cleanup',
      payload,
      requestId,
    );
  }

  private getBaseUrl(): string {
    const raw = this.configService.get<string>('RAG_SERVICE_URL')?.trim();
    if (!raw) {
      throw new InternalServerErrorException(ErrorCode.AI_SERVICE_UNAVAILABLE);
    }
    return raw.replace(/\/+$/, '');
  }

  private getApiKey(): string {
    const key = this.configService.get<string>('RAG_SERVICE_API_KEY')?.trim();
    if (!key) {
      throw new InternalServerErrorException(ErrorCode.AI_SERVICE_UNAVAILABLE);
    }
    return key;
  }

  private async post<T>(
    path: string,
    body: unknown,
    requestId: string,
    timeoutMs = RAG_TIMEOUT_MS,
  ): Promise<T> {
    const url = `${this.getBaseUrl()}/api/v1${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.getApiKey(),
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const invalidKey = /valid api key|author google ai/i.test(errorBody);
        this.logger.warn(
          `RAG ${path} failed status=${response.status} requestId=${requestId} body=${errorBody.slice(0, 500)}`,
        );
        if (invalidKey && path.includes('generate')) {
          throw new BadRequestException(ErrorCode.AUTHOR_AI_KEY_INVALID);
        }
        throw new InternalServerErrorException(
          ErrorCode.AI_SERVICE_UNAVAILABLE,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(
        `RAG ${path} unreachable requestId=${requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(ErrorCode.AI_SERVICE_UNAVAILABLE);
    }
  }
}
