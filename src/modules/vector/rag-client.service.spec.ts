import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/errors/error-codes';
import { RagClientService } from './rag-client.service';

describe('RagClientService', () => {
  let service: RagClientService;
  let configGet: jest.Mock;

  beforeEach(() => {
    configGet = jest.fn((key: string) => {
      if (key === 'RAG_SERVICE_URL') {
        return 'http://rag.test';
      }
      if (key === 'RAG_SERVICE_API_KEY') {
        return 'test-api-key';
      }
      return undefined;
    });

    service = new RagClientService({
      get: configGet,
    } as unknown as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws AI_SERVICE_UNAVAILABLE when RAG_SERVICE_URL is missing', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'RAG_SERVICE_API_KEY' ? 'test-api-key' : undefined,
    );

    await expect(
      service.askLesson({
        question: 'test',
        collection_name: 'course_1',
        metadata_filter: { course_id: '1', lesson_id: '2' },
      }),
    ).rejects.toMatchObject({
      response: { message: ErrorCode.AI_SERVICE_UNAVAILABLE },
    });
  });

  it('throws AI_SERVICE_UNAVAILABLE when RAG returns non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('unavailable'),
    });

    await expect(
      service.vectorizeLesson({
        text: 'hello',
        collection_name: 'course_1',
        metadata: {
          course_id: '1',
          lesson_id: '2',
          content_type: 'lesson_text',
        },
      }),
    ).rejects.toMatchObject({
      response: { message: ErrorCode.AI_SERVICE_UNAVAILABLE },
    });
  });

  it('throws AI_SERVICE_UNAVAILABLE when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(
      service.cleanupVectors({
        eventType: 'LESSON_DELETED',
        courseId: '1',
        lessonId: '2',
        collectionName: 'course_1',
      }),
    ).rejects.toMatchObject({
      response: { message: ErrorCode.AI_SERVICE_UNAVAILABLE },
    });
  });

  it('returns parsed JSON on success', async () => {
    const payload = { status: 'ok', request_id: 'req-1' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    await expect(
      service.cleanupVectors({
        eventType: 'COURSE_DELETED',
        courseId: '5',
        collectionName: 'course_5',
      }),
    ).resolves.toEqual(payload);

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    expect(fetchMock).toHaveBeenCalledWith(
      'http://rag.test/api/v1/vector-cleanup',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe(
      'test-api-key',
    );
  });
});
