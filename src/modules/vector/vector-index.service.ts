import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RagClientService } from './rag-client.service';

interface VectorizeLessonInput {
  id: string;
  courseId: string;
  content: string;
}

@Injectable()
export class VectorIndexService {
  private readonly logger = new Logger(VectorIndexService.name);

  constructor(private readonly ragClient: RagClientService) {}

  scheduleVectorizeLesson(lesson: VectorizeLessonInput): void {
    const text = lesson.content.trim();
    if (!text) {
      return;
    }

    const requestId = randomUUID();
    void this.ragClient
      .vectorizeLesson(
        {
          text,
          collection_name: `course_${lesson.courseId}`,
          metadata: {
            course_id: lesson.courseId,
            lesson_id: lesson.id,
            content_type: 'lesson_text',
          },
        },
        requestId,
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Vectorize failed lessonId=${lesson.id} requestId=${requestId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  scheduleDeleteLessonVectors(courseId: string, lessonId: string): void {
    const requestId = randomUUID();
    void this.ragClient
      .cleanupVectors(
        {
          eventType: 'LESSON_DELETED',
          courseId,
          lessonId,
          collectionName: `course_${courseId}`,
        },
        requestId,
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Lesson vector cleanup failed lessonId=${lessonId} requestId=${requestId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  scheduleDeleteCourseVectors(courseId: string): void {
    const requestId = randomUUID();
    void this.ragClient
      .cleanupVectors(
        {
          eventType: 'COURSE_DELETED',
          courseId,
          collectionName: `course_${courseId}`,
        },
        requestId,
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Course vector cleanup failed courseId=${courseId} requestId=${requestId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }
}
