import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseEnrollmentStatus, CourseStatus, Role } from '@prisma/client';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { CheckoutItemDto, CheckoutItemType } from './dto/checkout.dto';
import {
  CheckoutResponseDto,
  CheckoutResultItemDto,
} from './dto/checkout-response.dto';
import { MyLibraryDto } from './dto/my-library.dto';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  async hasLessonPurchase(userId: string, lessonId: string): Promise<boolean> {
    const purchase = await this.prisma.lessonPurchase.findUnique({
      where: { lessonId_userId: { lessonId, userId } },
    });
    return !!purchase;
  }

  async hasVideoPurchase(userId: string, videoId: string): Promise<boolean> {
    const purchase = await this.prisma.videoPurchase.findUnique({
      where: { videoId_userId: { videoId, userId } },
    });
    return !!purchase;
  }

  async hasAnyVideoPurchaseInLesson(
    userId: string,
    lessonId: string,
  ): Promise<boolean> {
    const count = await this.prisma.videoPurchase.count({
      where: { userId, video: { lessonId } },
    });
    return count > 0;
  }

  async getOwnedVideoIds(userId: string, lessonId: string): Promise<string[]> {
    const purchases = await this.prisma.videoPurchase.findMany({
      where: { userId, video: { lessonId } },
      select: { videoId: true },
    });
    return purchases.map((p) => p.videoId);
  }

  async hasLessonAccess(
    userId: string,
    lessonId: string,
    courseId: string,
    authorId: string,
    courseStatus: CourseStatus,
    firstLessonId?: string,
  ): Promise<boolean> {
    if (authorId === userId) {
      return true;
    }

    const hasCourseAccess = await this.enrollmentsService.hasApprovedAccess(
      userId,
      courseId,
    );
    if (hasCourseAccess) {
      return true;
    }

    if (await this.hasLessonPurchase(userId, lessonId)) {
      return true;
    }

    if (await this.hasAnyVideoPurchaseInLesson(userId, lessonId)) {
      return true;
    }

    return (
      courseStatus === CourseStatus.PUBLISHED && firstLessonId === lessonId
    );
  }

  async checkout(
    user: JwtPayloadUser,
    items: CheckoutItemDto[],
  ): Promise<CheckoutResponseDto> {
    this.assertSubscriber(user);

    const unique = this.deduplicateItems(items);
    const results: CheckoutResultItemDto[] = [];

    for (const item of unique) {
      try {
        await this.processCheckoutItem(user, item);
        results.push({ type: item.type, id: item.id, success: true });
      } catch (error) {
        results.push({
          type: item.type,
          id: item.id,
          success: false,
          message: error instanceof Error ? error.message : 'Purchase failed',
        });
      }
    }

    return { results };
  }

  async getMyLibrary(userId: string): Promise<MyLibraryDto> {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        userId,
        status: CourseEnrollmentStatus.APPROVED,
      },
      include: {
        course: {
          include: {
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { approvedAt: 'desc' },
    });

    const enrolledCourseIds = new Set(enrollments.map((item) => item.courseId));

    const lessonPurchases = await this.prisma.lessonPurchase.findMany({
      where: { userId },
      include: {
        lesson: {
          include: {
            course: {
              include: {
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    return {
      courses: enrollments.map((item) => ({
        id: item.course.id,
        title: item.course.title,
        ...(item.course.coverUrl ? { coverUrl: item.course.coverUrl } : {}),
        ...(item.course.category?.name
          ? { category: item.course.category.name }
          : {}),
      })),
      lessons: lessonPurchases
        .filter((item) => !enrolledCourseIds.has(item.lesson.courseId))
        .map((item) => ({
          id: item.lesson.id,
          title: item.lesson.title,
          courseId: item.lesson.courseId,
          courseTitle: item.lesson.course.title,
          ...(item.lesson.course.coverUrl
            ? { coverUrl: item.lesson.course.coverUrl }
            : {}),
        })),
    };
  }

  private deduplicateItems(items: CheckoutItemDto[]): CheckoutItemDto[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async processCheckoutItem(
    user: JwtPayloadUser,
    item: CheckoutItemDto,
  ): Promise<void> {
    switch (item.type) {
      case CheckoutItemType.COURSE:
        await this.checkoutCourse(user, item.id);
        return;
      case CheckoutItemType.LESSON:
        await this.purchaseLesson(user, item.id);
        return;
      default:
        throw new BadRequestException('Unsupported item type');
    }
  }

  private async checkoutCourse(
    user: JwtPayloadUser,
    courseId: string,
  ): Promise<void> {
    await this.enrollmentsService.grantCourseAccess(courseId, user);
  }

  private async purchaseLesson(
    user: JwtPayloadUser,
    lessonId: string,
  ): Promise<void> {
    const lesson = await this.getPurchasableLesson(lessonId);

    if (lesson.priceCents == null || lesson.priceCents <= 0) {
      throw new BadRequestException('Lesson is not sold separately');
    }

    const existing = await this.prisma.lessonPurchase.findUnique({
      where: { lessonId_userId: { lessonId, userId: user.id } },
    });
    if (existing) {
      return;
    }

    const hasCourseAccess = await this.enrollmentsService.hasApprovedAccess(
      user.id,
      lesson.courseId,
    );
    if (hasCourseAccess) {
      return;
    }

    await this.prisma.lessonPurchase.create({
      data: { lessonId, userId: user.id },
    });
  }

  private async getPurchasableLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });
    if (!lesson || lesson.course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  private assertSubscriber(user: JwtPayloadUser): void {
    if (user.role !== Role.SUBSCRIBER) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN_ROLE);
    }
  }
}
