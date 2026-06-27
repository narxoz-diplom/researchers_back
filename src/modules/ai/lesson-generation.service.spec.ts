import { ConfigService } from '@nestjs/config';
import { DEFAULT_PRO_LLM_MODEL_ID } from './ai.constants';
import { LessonGenerationService } from './lesson-generation.service';
import type { AuthorAiSettingsService } from './author-ai-settings.service';
import type { RagGenerateSingleLessonRequest } from '../vector/rag-client.types';
import type { RagClientService } from '../vector/rag-client.service';
import type { PrismaService } from '../../prisma/prisma.service';

function getGeneratePayload(
  mock: { generateSingleLesson: jest.Mock },
  index = 0,
): RagGenerateSingleLessonRequest {
  const call = mock.generateSingleLesson.mock.calls[index] as
    | [RagGenerateSingleLessonRequest, string]
    | undefined;
  if (!call) {
    throw new Error('Expected generateSingleLesson to be called');
  }
  return call[0];
}

describe('LessonGenerationService', () => {
  const lessonId = 'lesson-1';
  const authorId = 'author-1';
  const courseId = 'course-9';

  let service: LessonGenerationService;
  let ragClient: { generateSingleLesson: jest.Mock };
  let authorAiSettings: { getDecryptedKey: jest.Mock };
  let prisma: {
    lessonGenerationJob: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    ragClient = {
      generateSingleLesson: jest.fn().mockResolvedValue({
        task_id: 'task-1',
        status: 'processing',
        request_id: 'req-1',
      }),
    };
    authorAiSettings = {
      getDecryptedKey: jest.fn().mockResolvedValue('gemini-key'),
    };
    prisma = {
      lessonGenerationJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
      },
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'PUBLIC_API_URL') return 'http://localhost:8080';
        if (key === 'RAG_CALLBACK_SECRET') return 'secret';
        return undefined;
      }),
    };

    service = new LessonGenerationService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      authorAiSettings as unknown as AuthorAiSettingsService,
      ragClient as unknown as RagClientService,
    );
  });

  it('passes output_format, metadata_filter, callback_url and pro model default to RAG', async () => {
    await service.startGeneration(
      authorId,
      lessonId,
      {
        language: 'ru',
        brief: 'Focus on Bayes theorem',
        llmModelId: '',
        targetAudience: 'pro',
        depth: 'deep',
        outputFormat: 'expert_brief',
      },
      {
        id: lessonId,
        title: 'Intro',
        content: 'Existing snippet',
        course: { id: courseId, authorId },
      },
    );

    expect(ragClient.generateSingleLesson).toHaveBeenCalledTimes(1);
    const payload = getGeneratePayload(ragClient);
    expect(payload.collection_name).toBe(`course_${courseId}`);
    expect(payload.top_k).toBe(32);
    expect(payload.llm_model_id).toBe(DEFAULT_PRO_LLM_MODEL_ID);
    expect(payload.metadata_filter).toEqual({
      course_id: courseId,
      lesson_id: lessonId,
    });
    expect(payload.params).toMatchObject({
      target_audience: 'pro',
      depth: 'deep',
      output_format: 'expert_brief',
      output_language: 'ru',
      retrieval_mode: 'semantic',
    });
    expect(payload.summary).toContain('Focus on Bayes theorem');
    expect(payload.gemini_api_key).toBe('gemini-key');
    expect(payload.callback_url).toContain('/api/v1/rag/generation-callback');
    expect(payload.callback_url).toContain('jobId=job-1');
  });

  it('defaults to lecture format and bachelor audience', async () => {
    await service.startGeneration(
      authorId,
      lessonId,
      {
        language: 'en',
        brief: 'Overview',
        llmModelId: 'gemini-2.5-flash',
      },
      {
        id: lessonId,
        title: 'Intro',
        content: null,
        course: { id: courseId, authorId },
      },
    );

    const payload = getGeneratePayload(ragClient);
    expect(payload.top_k).toBe(24);
    expect(payload.params?.output_format).toBe('lecture');
    expect(payload.params?.target_audience).toBe('bachelor');
    expect(payload.params?.depth).toBe('medium');
    expect(payload.params?.generation_phase).toBe('content');
  });

  it('passes outline phase and approved outline to RAG', async () => {
    await service.startGeneration(
      authorId,
      lessonId,
      {
        language: 'ru',
        brief: 'Topic focus',
        llmModelId: 'gemini-2.5-flash',
        phase: 'content',
        approvedOutline: '- Intro\n- Core theory\n- Discussion',
      },
      {
        id: lessonId,
        title: 'Intro',
        content: null,
        course: { id: courseId, authorId },
      },
    );

    const payload = getGeneratePayload(ragClient);
    expect(payload.params?.generation_phase).toBe('content');
    expect(payload.params?.approved_outline).toBe(
      '- Intro\n- Core theory\n- Discussion',
    );
  });
});
