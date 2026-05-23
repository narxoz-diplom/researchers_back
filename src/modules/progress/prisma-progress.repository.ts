import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IProgressRepository } from './progress.repository.interface';

@Injectable()
export class PrismaProgressRepository implements IProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertComplete(userId: string, lessonId: string) {
    return this.prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId },
      update: { completedAt: new Date() },
    });
  }

  async remove(userId: string, lessonId: string): Promise<boolean> {
    const result = await this.prisma.progress.deleteMany({
      where: { userId, lessonId },
    });
    return result.count > 0;
  }

  findByUserAndCourse(userId: string, courseId: string) {
    return this.prisma.progress.findMany({
      where: { userId, lesson: { courseId } },
      select: { lessonId: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findByUser(userId: string) {
    const rows = await this.prisma.progress.findMany({
      where: { userId },
      select: {
        lessonId: true,
        completedAt: true,
        lesson: { select: { courseId: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    return rows.map((row) => ({
      lessonId: row.lessonId,
      courseId: row.lesson.courseId,
      completedAt: row.completedAt,
    }));
  }

  countLessonsByCourse(courseId: string): Promise<number> {
    return this.prisma.lesson.count({ where: { courseId } });
  }
}
