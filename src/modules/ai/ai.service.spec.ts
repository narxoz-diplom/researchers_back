import { LessonVectorIndexStatus } from '@prisma/client';
import { AiService } from './ai.service';
import type { AuthorAiSettingsService } from './author-ai-settings.service';
import type { LessonChatQuotaService } from './lesson-chat-quota.service';
import type { LessonGenerationService } from './lesson-generation.service';
import type { RagClientService } from '../vector/rag-client.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ILessonsRepository } from '../lessons/lessons.repository.interface';

describe('AiService.startLessonGeneration', () => {
  const lessonId = 'lesson-1';
  const authorId = 'author-1';

  let service: AiService;
  let lessonGeneration: { startGeneration: jest.Mock };
  let authorAiSettings: { getDecryptedKey: jest.Mock };
  let lessonsRepository: { findByIdWithCourse: jest.Mock };

  beforeEach(() => {
    lessonGeneration = {
      startGeneration: jest.fn().mockResolvedValue({
        jobId: 'job-1',
        status: 'processing',
      }),
    };
    authorAiSettings = {
      getDecryptedKey: jest.fn().mockResolvedValue('gemini-key'),
    };
    lessonsRepository = {
      findByIdWithCourse: jest.fn().mockResolvedValue({
        id: lessonId,
        title: 'Intro',
        content: 'Existing snippet',
        vectorIndexStatus: LessonVectorIndexStatus.READY,
        vectorIndexJobId: null,
        course: { id: 'course-9', authorId },
      }),
    };

    service = new AiService(
      authorAiSettings as unknown as AuthorAiSettingsService,
      {} as RagClientService,
      {} as LessonChatQuotaService,
      lessonGeneration as unknown as LessonGenerationService,
      {
        lessonVectorIndexError: { findFirst: jest.fn() },
      } as unknown as PrismaService,
      lessonsRepository as unknown as ILessonsRepository,
    );
  });

  it('delegates to LessonGenerationService when index is ready', async () => {
    const dto = {
      language: 'ru' as const,
      brief: 'Focus on Bayes theorem',
      llmModelId: 'gemini-2.5-flash',
    };

    const result = await service.startLessonGeneration(authorId, lessonId, dto);

    expect(result).toEqual({ jobId: 'job-1', status: 'processing' });
    expect(lessonGeneration.startGeneration).toHaveBeenCalledWith(
      authorId,
      lessonId,
      dto,
      expect.objectContaining({ id: lessonId }),
    );
  });
});
