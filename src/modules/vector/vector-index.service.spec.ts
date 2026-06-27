import { RagClientService } from './rag-client.service';
import { VectorIndexService } from './vector-index.service';

describe('VectorIndexService', () => {
  let ragClient: jest.Mocked<
    Pick<RagClientService, 'vectorizeLesson' | 'cleanupVectors'>
  >;
  let service: VectorIndexService;

  beforeEach(() => {
    ragClient = {
      vectorizeLesson: jest.fn().mockResolvedValue({ status: 'ok' }),
      cleanupVectors: jest.fn().mockResolvedValue({ status: 'ok' }),
    };
    service = new VectorIndexService(ragClient as unknown as RagClientService);
  });

  it('skips vectorize for empty content', () => {
    service.scheduleVectorizeLesson({
      id: 'lesson-1',
      courseId: 'course-1',
      content: '   ',
    });

    expect(ragClient.vectorizeLesson).not.toHaveBeenCalled();
  });

  it('schedules vectorize without throwing when RAG fails', async () => {
    ragClient.vectorizeLesson.mockRejectedValue(new Error('RAG unavailable'));

    expect(() =>
      service.scheduleVectorizeLesson({
        id: 'lesson-1',
        courseId: 'course-1',
        content: 'Lesson body',
      }),
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(ragClient.vectorizeLesson).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Lesson body',
        collection_name: 'course_course-1',
        metadata: {
          course_id: 'course-1',
          lesson_id: 'lesson-1',
          content_type: 'lesson_text',
        },
      }),
      expect.any(String),
    );
  });

  it('schedules lesson cleanup without throwing when RAG fails', async () => {
    ragClient.cleanupVectors.mockRejectedValue(new Error('cleanup failed'));

    expect(() =>
      service.scheduleDeleteLessonVectors('course-1', 'lesson-1'),
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(ragClient.cleanupVectors).toHaveBeenCalledWith(
      {
        eventType: 'LESSON_DELETED',
        courseId: 'course-1',
        lessonId: 'lesson-1',
        collectionName: 'course_course-1',
      },
      expect.any(String),
    );
  });
});
