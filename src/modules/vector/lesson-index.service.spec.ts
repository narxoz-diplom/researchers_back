import { LessonVectorIndexStatus } from '@prisma/client';
import { LessonIndexService } from './lesson-index.service';

describe('LessonIndexService', () => {
  const ragClient = {
    vectorizeLesson: jest.fn(),
    ingestFile: jest.fn(),
    cleanupMedia: jest.fn(),
  };
  const vectorIndex = {
    scheduleDeleteLessonVectors: jest.fn(),
    scheduleDeleteCourseVectors: jest.fn(),
  };
  const notifications = {
    notifyIndexFailed: jest.fn(),
  };
  const mediaService = {
    downloadForIndexing: jest.fn(),
  };
  const prisma = {
    lesson: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    lessonIndexTask: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    lessonIndexJob: {
      create: jest.fn(),
    },
    lessonVectorIndexError: {
      create: jest.fn(),
    },
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'PUBLIC_API_URL') return undefined;
      if (key === 'RAG_CALLBACK_SECRET') return 'secret';
      return undefined;
    }),
  };

  let service: LessonIndexService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LessonIndexService(
      prisma as never,
      configService as never,
      ragClient as never,
      vectorIndex as never,
      notifications as never,
      mediaService as never,
    );
  });

  it('ignores stale callback when jobId does not match lesson', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null);

    await service.handleRagCallback({
      jobId: 'job-old',
      taskKey: 'text',
      payload: { status: 'completed' },
    });

    expect(prisma.lessonIndexTask.update).not.toHaveBeenCalled();
  });

  it('marks lesson ready when all tasks complete', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      vectorIndexJobId: 'job-1',
      course: { authorId: 'author-1' },
    });
    prisma.lessonIndexTask.findUnique.mockResolvedValue({
      id: 'task-1',
      status: 'PENDING',
    });
    prisma.lessonIndexTask.update.mockResolvedValue({});
    prisma.lessonIndexTask.findMany.mockResolvedValue([
      { status: 'COMPLETED' },
      { status: 'COMPLETED' },
    ]);
    prisma.lesson.updateMany.mockResolvedValue({ count: 1 });

    await service.handleRagCallback({
      jobId: 'job-1',
      taskKey: 'text',
      payload: { status: 'completed' },
    });

    expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
      where: { id: 'lesson-1', vectorIndexJobId: 'job-1' },
      data: {
        vectorIndexStatus: LessonVectorIndexStatus.READY,
        vectorIndexedAt: expect.any(Date) as Date,
      },
    });
  });
});
