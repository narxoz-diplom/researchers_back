import { randomBytes } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';
import { CHAT_MESSAGE_LIMIT_BASIC } from './../src/modules/ai/ai.constants';
import { PrismaService } from './../src/prisma/prisma.service';
import { RagClientService } from './../src/modules/vector/rag-client.service';
import type {
  RagAskRequest,
  RagGenerateSingleLessonRequest,
  RagVectorizeTextRequest,
} from './../src/modules/vector/rag-client.types';

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

describe('AI QA (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authorToken: string;
  let subscriberToken: string;
  let subscriberId: string;
  let courseId: string;
  let lesson1Id: string;
  let lesson2Id: string;

  const ragClientMock = {
    generateSingleLesson: jest.fn(),
    askLesson: jest.fn(),
    vectorizeLesson: jest.fn(),
    cleanupVectors: jest.fn(),
  };

  function getGeneratePayload(index = -1): RagGenerateSingleLessonRequest {
    const calls = ragClientMock.generateSingleLesson.mock.calls as Array<
      [RagGenerateSingleLessonRequest]
    >;
    const call = index < 0 ? calls.at(index) : calls[index];
    expect(call).toBeDefined();
    return call![0];
  }

  function getVectorizePayload(): RagVectorizeTextRequest {
    const calls = ragClientMock.vectorizeLesson.mock.calls as Array<
      [RagVectorizeTextRequest]
    >;
    const call = calls.at(-1);
    expect(call).toBeDefined();
    return call![0];
  }

  function getAskPayload(): RagAskRequest {
    const calls = ragClientMock.askLesson.mock.calls as Array<[RagAskRequest]>;
    const call = calls.at(-1);
    expect(call).toBeDefined();
    return call![0];
  }

  const defaultGenerationResult = {
    lessons: [
      {
        title: 'Generated lesson',
        content: '# Generated\n\nNeural networks explained.',
      },
    ],
    collection_name: 'course_mock',
    chunks_used: 4,
    request_id: 'gen-req-1',
    usage: {
      llm_model_id: 'gemini-2.5-flash',
      provider: 'google',
      provider_model_id: 'gemini-2.5-flash',
      total_tokens: 120,
    },
  };

  async function completeGenerationCallback(
    jobId: string,
    result: typeof defaultGenerationResult = defaultGenerationResult,
  ) {
    await request(app.getHttpServer())
      .post(
        `/api/v1/rag/generation-callback?jobId=${jobId}&secret=test-callback-secret`,
      )
      .send({
        task_id: 'gen-task-1',
        status: 'completed',
        result,
      })
      .expect(201);
  }

  async function generateLessonAndWait(
    lessonId: string,
    body: Record<string, unknown>,
    options?: {
      result?: typeof defaultGenerationResult;
      expectedStartStatus?: number;
    },
  ) {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        vectorIndexStatus: 'READY',
        vectorIndexedAt: new Date(),
        vectorIndexJobId: null,
      },
    });

    const startRes = await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/generate`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send(body)
      .expect(options?.expectedStartStatus ?? 202);

    const jobId = (startRes.body as { jobId: string }).jobId;
    await completeGenerationCallback(
      jobId,
      options?.result ?? defaultGenerationResult,
    );

    return request(app.getHttpServer())
      .get(`/api/v1/lessons/${lessonId}/generate/jobs/${jobId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);
  }

  beforeAll(async () => {
    process.env.AI_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
    process.env.RAG_SERVICE_URL ??= 'http://rag.test';
    process.env.RAG_SERVICE_API_KEY ??= 'test-rag-key';
    process.env.PUBLIC_API_URL ??= 'http://localhost:3000';
    process.env.RAG_CALLBACK_SECRET = 'test-callback-secret';

    ragClientMock.generateSingleLesson.mockResolvedValue({
      task_id: 'gen-task-1',
      status: 'processing',
      request_id: 'gen-req-1',
    });

    ragClientMock.vectorizeLesson.mockResolvedValue({
      document_id: 'doc-1',
      chunks_count: 3,
      collection_name: 'course_mock',
      status: 'ok',
      request_id: 'vec-req-1',
    });

    ragClientMock.cleanupVectors.mockResolvedValue({
      status: 'ok',
      request_id: 'cleanup-req-1',
    });

    ragClientMock.askLesson.mockImplementation(
      (payload: {
        question: string;
        metadata_filter: { lesson_id: string; course_id: string };
      }) => {
        const scopedLessonId = payload.metadata_filter.lesson_id;

        if (
          scopedLessonId === lesson1Id &&
          payload.question.includes('QUANTUM_SECRET_LESSON_2')
        ) {
          return {
            answer:
              'This topic is not covered in the current lesson. Please ask about photosynthesis.',
            collection_name: `course_${courseId}`,
            chunks_used: 0,
            request_id: 'ask-req-isolated',
            usage: {
              llm_model_id: 'gemini-2.5-flash',
              provider: 'google',
              provider_model_id: 'gemini-2.5-flash',
              total_tokens: 40,
            },
          };
        }

        return {
          answer: `Answer scoped to lesson ${scopedLessonId}: ${payload.question}`,
          collection_name: `course_${courseId}`,
          chunks_used: 2,
          request_id: 'ask-req-1',
          usage: {
            llm_model_id: 'gemini-2.5-flash',
            provider: 'google',
            provider_model_id: 'gemini-2.5-flash',
            total_tokens: 80,
          },
        };
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RagClientService)
      .useValue(ragClientMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const authorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'author@researchers.local',
        password: 'Author123!',
      })
      .expect(200);
    authorToken = (authorLogin.body as { accessToken: string }).accessToken;

    const subscriberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'subscriber@researchers.local',
        password: 'Subscriber123!',
      })
      .expect(200);
    subscriberToken = (subscriberLogin.body as { accessToken: string })
      .accessToken;

    const subscriberMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);
    subscriberId = (subscriberMe.body as { id: string }).id;

    await prisma.lessonChatUsage.deleteMany({
      where: { userId: subscriberId },
    });

    const courseRes = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'AI QA Course',
        description: 'Course for AI QA scenarios',
      });
    courseId = (courseRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${authorToken}`);

    const lesson1Res = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Photosynthesis',
        content: 'Lesson 1 about photosynthesis and chlorophyll.',
        orderNumber: 1,
      });
    lesson1Id = (lesson1Res.body as { id: string }).id;

    const lesson2Res = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Quantum mechanics',
        content: 'Lesson 2 QUANTUM_SECRET_LESSON_2 about wave functions.',
        orderNumber: 2,
      });
    lesson2Id = (lesson2Res.body as { id: string }).id;

    await prisma.lesson.updateMany({
      where: { courseId },
      data: {
        vectorIndexStatus: 'READY',
        vectorIndexedAt: new Date(),
        vectorIndexJobId: null,
      },
    });

    await new Promise((resolve) => setImmediate(resolve));
    ragClientMock.vectorizeLesson.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Q1 — Author flow', () => {
    it('author saves Google AI Studio key in settings', async () => {
      const saveRes = await request(app.getHttpServer())
        .patch('/api/v1/users/me/ai-settings')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ apiKey: 'AIzaSyTestAuthorKey1234567890' })
        .expect(200);

      expect(saveRes.body).toMatchObject({
        hasApiKey: true,
        keyHint: '7890',
      });

      const getRes = await request(app.getHttpServer())
        .get('/api/v1/users/me/ai-settings')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      expect((getRes.body as { hasApiKey: boolean }).hasApiKey).toBe(true);
    });

    it('generate without key returns AUTHOR_AI_KEY_REQUIRED', async () => {
      const freshAuthorEmail = `ai-no-key-${Date.now()}@test.local`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: freshAuthorEmail,
          password: 'Password1!',
          fullName: 'No Key Author',
          role: 'AUTHOR',
        })
        .expect(201);

      await prisma.user.update({
        where: { email: freshAuthorEmail },
        data: { emailVerified: true },
      });

      const freshLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: freshAuthorEmail, password: 'Password1!' })
        .expect(200);
      const freshToken = (freshLogin.body as { accessToken: string })
        .accessToken;

      const courseRes = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          title: 'No Key Course',
          description: 'Author without AI key',
        });
      const ownCourseId = (courseRes.body as { id: string }).id;

      const lessonRes = await request(app.getHttpServer())
        .post(`/api/v1/courses/${ownCourseId}/lessons`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          title: 'Draft',
          content: 'Draft content',
          orderNumber: 1,
        });
      const ownLessonId = (lessonRes.body as { id: string }).id;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/lessons/${ownLessonId}/generate`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          language: 'ru',
          brief: 'Explain photosynthesis briefly.',
          llmModelId: 'gemini-2.5-flash',
        })
        .expect(400);

      expect((res.body as { message: string }).message).toBe(
        'AUTHOR_AI_KEY_REQUIRED',
      );
    });

    it('studio generate uses language + brief and BYOK key', async () => {
      const res = await generateLessonAndWait(lesson1Id, {
        language: 'ru',
        brief: 'Explain neural networks with practical examples.',
        llmModelId: 'gemini-2.5-flash',
      });

      expect(res.body).toMatchObject({
        status: 'completed',
        title: 'Generated lesson',
      });
      expect((res.body as { content: string }).content).toContain(
        'Neural networks',
      );

      const payload = getGeneratePayload();
      expect(payload.collection_name).toBe(`course_${courseId}`);
      expect(payload.gemini_api_key).toBe('AIzaSyTestAuthorKey1234567890');
      expect(payload.callback_url).toContain('/api/v1/rag/generation-callback');
      expect(payload.params).toMatchObject({
        output_language: 'ru',
      });
    });

    it('save lesson content schedules vectorize with lesson_id metadata', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/lessons/${lesson1Id}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          content: 'Updated lesson body for vector indexing.',
        })
        .expect(200);

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ragClientMock.vectorizeLesson).toHaveBeenCalled();
      const vectorizePayload = getVectorizePayload();
      expect(vectorizePayload.text).toContain(
        'Updated lesson body for vector indexing.',
      );
      expect(vectorizePayload.collection_name).toBe(`course_${courseId}`);
      expect(vectorizePayload.metadata).toEqual({
        course_id: courseId,
        lesson_id: lesson1Id,
        content_type: 'lesson_text',
      });
      expect(vectorizePayload.callback_url).toContain(
        '/api/v1/rag/index-callback',
      );

      const lesson = await prisma.lesson.findUnique({
        where: { id: lesson1Id },
      });
      expect(lesson?.vectorIndexStatus).toBe('INDEXING');
    });

    it('generate blocked while lesson index is not ready', async () => {
      await prisma.lesson.update({
        where: { id: lesson1Id },
        data: { vectorIndexStatus: 'INDEXING' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/lessons/${lesson1Id}/generate`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          language: 'ru',
          brief: 'Explain photosynthesis briefly.',
          llmModelId: 'gemini-2.5-flash',
        })
        .expect(400);

      expect((res.body as { message: string }).message).toBe(
        'LESSON_INDEX_IN_PROGRESS',
      );

      await prisma.lesson.update({
        where: { id: lesson1Id },
        data: {
          vectorIndexStatus: 'READY',
          vectorIndexedAt: new Date(),
        },
      });
    });
  });

  describe('Q2 — Subscriber chat', () => {
    it('subscriber with access gets lesson-scoped answer', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lessons/${lesson1Id}/chat`)
        .set('Authorization', `Bearer ${subscriberToken}`)
        .send({ message: 'What is photosynthesis?' })
        .expect(201);

      expect((res.body as { answer: string }).answer).toContain(lesson1Id);
      expect(
        (res.body as { remainingMessages: number }).remainingMessages,
      ).toBe(CHAT_MESSAGE_LIMIT_BASIC - 1);

      expect(ragClientMock.askLesson).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'What is photosynthesis?',
          collection_name: `course_${courseId}`,
          metadata_filter: {
            lesson_id: lesson1Id,
            course_id: courseId,
          },
        }),
        expect.any(String),
      );
    });

    it('exhausted quota returns CHAT_LIMIT_EXCEEDED', async () => {
      const periodStart = startOfUtcMonth(new Date());

      await prisma.lessonChatUsage.upsert({
        where: {
          userId_periodStart: { userId: subscriberId, periodStart },
        },
        create: {
          userId: subscriberId,
          periodStart,
          messageCount: CHAT_MESSAGE_LIMIT_BASIC,
          tokenCount: 0,
        },
        update: {
          messageCount: CHAT_MESSAGE_LIMIT_BASIC,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/lessons/${lesson1Id}/chat`)
        .set('Authorization', `Bearer ${subscriberToken}`)
        .send({ message: 'One more question' })
        .expect(403);

      expect((res.body as { message: string }).message).toBe(
        'CHAT_LIMIT_EXCEEDED',
      );
    });
  });

  describe('Q3 — Cross-lesson isolation', () => {
    it('asks on lesson 1 stay scoped to lesson 1 even about lesson 2 topic', async () => {
      await prisma.lessonChatUsage.updateMany({
        where: { userId: subscriberId },
        data: { messageCount: 0 },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/lessons/${lesson1Id}/chat`)
        .set('Authorization', `Bearer ${subscriberToken}`)
        .send({
          message: 'Explain QUANTUM_SECRET_LESSON_2 in detail',
        })
        .expect(201);

      expect((res.body as { answer: string }).answer).toMatch(
        /not covered in the current lesson/i,
      );

      const lastCall = getAskPayload();
      expect(lastCall.metadata_filter).toEqual({
        lesson_id: lesson1Id,
        course_id: courseId,
      });
      expect(lastCall.metadata_filter.lesson_id).not.toBe(lesson2Id);
    });
  });

  describe('Q4 — Generation v2', () => {
    beforeEach(() => {
      ragClientMock.generateSingleLesson.mockClear();
      ragClientMock.generateSingleLesson.mockResolvedValue({
        task_id: 'gen-task-1',
        status: 'processing',
        request_id: 'gen-v2-req',
      });
    });

    async function generateLesson(
      lessonId: string,
      body: Record<string, unknown>,
      expectedStartStatus = 202,
      result?: typeof defaultGenerationResult,
    ) {
      if (expectedStartStatus !== 202) {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: {
            vectorIndexStatus: 'READY',
            vectorIndexedAt: new Date(),
            vectorIndexJobId: null,
          },
        });

        return request(app.getHttpServer())
          .post(`/api/v1/lessons/${lessonId}/generate`)
          .set('Authorization', `Bearer ${authorToken}`)
          .send(body)
          .expect(expectedStartStatus);
      }

      return generateLessonAndWait(lessonId, body, { result });
    }

    it('INDEXING blocks generate', async () => {
      ragClientMock.generateSingleLesson.mockClear();

      await prisma.lesson.update({
        where: { id: lesson2Id },
        data: { vectorIndexStatus: 'INDEXING' },
      });

      const blocked = await request(app.getHttpServer())
        .post(`/api/v1/lessons/${lesson2Id}/generate`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          language: 'ru',
          brief: 'Should be blocked.',
          llmModelId: 'gemini-2.5-flash',
        })
        .expect(400);

      expect((blocked.body as { message: string }).message).toBe(
        'LESSON_INDEX_IN_PROGRESS',
      );
      expect(ragClientMock.generateSingleLesson).not.toHaveBeenCalled();
    });

    it('PhD flow forwards expert_brief + pro + deep to RAG with lesson scope', async () => {
      const res = await generateLesson(
        lesson1Id,
        {
          language: 'en',
          brief: 'Focus on Bayesian inference for experienced researchers.',
          llmModelId: 'gemini-2.5-pro',
          targetAudience: 'pro',
          depth: 'deep',
          outputFormat: 'expert_brief',
        },
        202,
        {
          lessons: [
            {
              title: 'Bayesian inference',
              content:
                '## Introduction\n\nPosterior updating under uncertainty.\n\n## Methodological limits\n\n...',
            },
          ],
          collection_name: `course_${courseId}`,
          chunks_used: 8,
          request_id: 'gen-phd',
        },
      );

      const content = (res.body as { content: string }).content;
      expect(content).not.toMatch(/Цели обучения|learning_objectives/i);
      expect(content).not.toMatch(/Основное объяснение|core_explanation/i);

      expect(ragClientMock.generateSingleLesson).toHaveBeenCalled();
      const payload = getGeneratePayload();
      expect(payload.top_k).toBe(32);
      expect(payload.llm_model_id).toBe('gemini-2.5-pro');
      expect(payload.metadata_filter).toEqual({
        course_id: courseId,
        lesson_id: lesson1Id,
      });
      expect(payload.params).toMatchObject({
        output_format: 'expert_brief',
        target_audience: 'pro',
        depth: 'deep',
        generation_phase: 'content',
        retrieval_mode: 'semantic',
      });
    });

    it('bachelor lecture flow defaults to lecture format', async () => {
      const res = await generateLesson(
        lesson1Id,
        {
          language: 'ru',
          brief: 'Explain photosynthesis for undergraduates.',
          llmModelId: 'gemini-2.5-flash',
          targetAudience: 'bachelor',
          outputFormat: 'lecture',
        },
        202,
        {
          lessons: [
            {
              title: 'Photosynthesis lecture',
              content:
                'Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs photons...',
            },
          ],
          collection_name: `course_${courseId}`,
          chunks_used: 3,
          request_id: 'gen-lecture',
        },
      );

      const content = (res.body as { content: string }).content;
      expect(content.length).toBeGreaterThan(40);
      expect(content).not.toContain('Практические задания');

      const payload = getGeneratePayload();
      expect(payload.params?.output_format).toBe('lecture');
      expect(payload.top_k).toBe(24);
    });

    it('structured legacy format is forwarded to RAG', async () => {
      await generateLesson(
        lesson1Id,
        {
          language: 'ru',
          brief: 'Classic LMS lesson about chlorophyll.',
          llmModelId: 'gemini-2.5-flash',
          outputFormat: 'structured',
        },
        202,
        {
          lessons: [
            {
              title: 'Structured lesson',
              content:
                '## Цели обучения\n\nGoals here.\n\n## Основное объяснение\n\nCore text.',
            },
          ],
          collection_name: `course_${courseId}`,
          chunks_used: 2,
          request_id: 'gen-structured',
        },
      );

      const payload = getGeneratePayload();
      expect(payload.params?.output_format).toBe('structured');
    });

    it('generation on lesson 1 scopes metadata_filter to lesson 1, not lesson 2', async () => {
      await generateLesson(lesson1Id, {
        language: 'en',
        brief: 'Photosynthesis only.',
        llmModelId: 'gemini-2.5-flash',
      });

      const payload1 = getGeneratePayload(0);
      expect(payload1.metadata_filter).toEqual({
        course_id: courseId,
        lesson_id: lesson1Id,
      });
      expect(payload1.summary).toContain('Photosynthesis');

      ragClientMock.generateSingleLesson.mockClear();

      await generateLesson(lesson2Id, {
        language: 'en',
        brief: 'Quantum mechanics only.',
        llmModelId: 'gemini-2.5-flash',
      });

      const payload2 = getGeneratePayload(0);
      expect(payload2.metadata_filter).toEqual({
        course_id: courseId,
        lesson_id: lesson2Id,
      });
      expect(payload2.summary).toContain('Quantum');
      expect(payload2.metadata_filter?.lesson_id).not.toBe(lesson1Id);
    });

    it('outline phase and approvedOutline are forwarded', async () => {
      await generateLesson(lesson1Id, {
        language: 'ru',
        brief: 'Plan a lecture on chlorophyll.',
        llmModelId: 'gemini-2.5-flash',
        phase: 'content',
        approvedOutline: '- History\n- Mechanism\n- Open questions',
      });

      const payload = getGeneratePayload();
      expect(payload.params?.generation_phase).toBe('content');
      expect(payload.params?.approved_outline).toBe(
        '- History\n- Mechanism\n- Open questions',
      );
    });

    it('rejects unknown outputFormat with 400', async () => {
      const res = await generateLesson(
        lesson1Id,
        {
          language: 'ru',
          brief: 'Test invalid format.',
          llmModelId: 'gemini-2.5-flash',
          outputFormat: 'invalid_format',
        },
        400,
      );

      expect(ragClientMock.generateSingleLesson).not.toHaveBeenCalled();
      expect(res.body).toBeDefined();
    });

    it('READY allows generate after indexing', async () => {
      ragClientMock.generateSingleLesson.mockClear();

      await generateLesson(lesson2Id, {
        language: 'ru',
        brief: 'Should work when READY.',
        llmModelId: 'gemini-2.5-flash',
      });

      expect(ragClientMock.generateSingleLesson).toHaveBeenCalledTimes(1);
    });
  });
});
