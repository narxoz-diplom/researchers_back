import { Progress } from '@prisma/client';

export interface IProgressRepository {
  upsertComplete(userId: string, lessonId: string): Promise<Progress>;
  remove(userId: string, lessonId: string): Promise<boolean>;
  findByUserAndCourse(
    userId: string,
    courseId: string,
  ): Promise<{ lessonId: string; completedAt: Date }[]>;
  findByUser(
    userId: string,
  ): Promise<{ lessonId: string; courseId: string; completedAt: Date }[]>;
  countLessonsByCourse(courseId: string): Promise<number>;
}
