import { Injectable } from '@nestjs/common';
import { resolveLessonPrices } from '../../common/utils/resolve-course-content-prices';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CoursePricingService {
  constructor(private readonly prisma: PrismaService) {}

  async syncLessonPrices(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        priceCents: true,
        lessons: {
          select: { id: true },
          orderBy: { orderNumber: 'asc' },
        },
      },
    });

    if (!course || course.lessons.length === 0) {
      return;
    }

    const prices = resolveLessonPrices(
      course.priceCents,
      course.lessons.length,
    );

    await this.prisma.$transaction(
      course.lessons.map((lesson, index) =>
        this.prisma.lesson.update({
          where: { id: lesson.id },
          data: { priceCents: prices[index] },
        }),
      ),
    );
  }
}
