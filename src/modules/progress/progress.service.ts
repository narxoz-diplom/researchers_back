import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LESSONS_REPOSITORY } from '../lessons/lessons.constants';
import type { ILessonsRepository } from '../lessons/lessons.repository.interface';
import { PROGRESS_REPOSITORY } from './progress.constants';
import type { IProgressRepository } from './progress.repository.interface';
import {
  CourseProgressDto,
  LessonProgressDto,
} from './dto/progress-response.dto';

@Injectable()
export class ProgressService {
  constructor(
    @Inject(PROGRESS_REPOSITORY)
    private readonly progressRepository: IProgressRepository,
    @Inject(LESSONS_REPOSITORY)
    private readonly lessonsRepository: ILessonsRepository,
  ) {}

  async completeLesson(
    userId: string,
    lessonId: string,
  ): Promise<LessonProgressDto> {
    await this.ensureLessonExists(lessonId);
    const progress = await this.progressRepository.upsertComplete(
      userId,
      lessonId,
    );
    return {
      lessonId: progress.lessonId,
      completedAt: progress.completedAt.toISOString(),
    };
  }

  async uncompleteLesson(userId: string, lessonId: string): Promise<void> {
    await this.ensureLessonExists(lessonId);
    const removed = await this.progressRepository.remove(userId, lessonId);
    if (!removed) {
      throw new NotFoundException('Progress record not found');
    }
  }

  async getMyProgress(
    userId: string,
    courseId?: string,
  ): Promise<CourseProgressDto | CourseProgressDto[]> {
    if (courseId) {
      return this.buildCourseProgress(userId, courseId, true);
    }

    const rows = await this.progressRepository.findByUser(userId);
    const courseIds = [...new Set(rows.map((r) => r.courseId))];

    return Promise.all(
      courseIds.map((id) => this.buildCourseProgress(userId, id, false)),
    );
  }

  private async buildCourseProgress(
    userId: string,
    courseId: string,
    includeLessons: boolean,
  ): Promise<CourseProgressDto> {
    const totalLessons =
      await this.progressRepository.countLessonsByCourse(courseId);
    const completed = await this.progressRepository.findByUserAndCourse(
      userId,
      courseId,
    );

    const completedLessons = completed.length;
    const percentage =
      totalLessons > 0
        ? Math.floor((completedLessons / totalLessons) * 100)
        : 0;

    const lastCompletedAt = completed[0]?.completedAt.toISOString();

    return {
      courseId,
      totalLessons,
      completedLessons,
      percentage,
      ...(lastCompletedAt ? { lastCompletedAt } : {}),
      ...(includeLessons
        ? {
            lessons: completed.map((item) => ({
              lessonId: item.lessonId,
              completedAt: item.completedAt.toISOString(),
            })),
          }
        : {}),
    };
  }

  private async ensureLessonExists(lessonId: string): Promise<void> {
    const lesson = await this.lessonsRepository.findById(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
  }
}
