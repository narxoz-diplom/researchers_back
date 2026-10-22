import { Injectable } from '@nestjs/common';
import { CourseEnrollmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminEnrollmentFilters,
  AdminEnrollmentRow,
  AdminEnrollmentStats,
  EnrollmentWithCourse,
  EnrollmentWithUser,
  IEnrollmentsRepository,
  ListAdminEnrollmentsParams,
} from './enrollments.repository.interface';

@Injectable()
export class PrismaEnrollmentsRepository implements IEnrollmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCourseAndUser(courseId: string, userId: string) {
    return this.prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });
  }

  findById(id: string): Promise<EnrollmentWithCourse | null> {
    return this.prisma.courseEnrollment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, authorId: true } },
      },
    });
  }

  create(data: { courseId: string; userId: string; message?: string }) {
    return this.prisma.courseEnrollment.create({
      data: {
        courseId: data.courseId,
        userId: data.userId,
        ...(data.message ? { message: data.message } : {}),
      },
    });
  }

  update(id: string, data: Prisma.CourseEnrollmentUpdateInput) {
    return this.prisma.courseEnrollment.update({ where: { id }, data });
  }

  listByCourse(
    courseId: string,
    status?: CourseEnrollmentStatus,
  ): Promise<EnrollmentWithUser[]> {
    return this.prisma.courseEnrollment.findMany({
      where: {
        courseId,
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPendingPayments() {
    return this.prisma.courseEnrollment.findMany({
      where: { status: CourseEnrollmentStatus.PAID },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        course: { select: { id: true, title: true, priceCents: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async listForAdmin(
    params: ListAdminEnrollmentsParams,
  ): Promise<{ data: AdminEnrollmentRow[]; total: number }> {
    const where: Prisma.CourseEnrollmentWhereInput = {
      ...adminFiltersWhere(params),
      ...(params.status ? { status: params.status } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.courseEnrollment.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          course: { select: { id: true, title: true, priceCents: true } },
          events: {
            orderBy: { createdAt: 'asc' },
            include: {
              actor: { select: { id: true, fullName: true, role: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.courseEnrollment.count({ where }),
    ]);
    return { data, total };
  }

  async statsForAdmin(
    filters: AdminEnrollmentFilters,
  ): Promise<AdminEnrollmentStats> {
    const base = adminFiltersWhere(filters);
    const [grouped, sold, awaiting] = await Promise.all([
      this.prisma.courseEnrollment.groupBy({
        by: ['status'],
        where: base,
        _count: { status: true },
      }),
      this.prisma.courseEnrollment.aggregate({
        where: { ...base, status: CourseEnrollmentStatus.APPROVED },
        _sum: { paidAmountCents: true },
      }),
      this.prisma.courseEnrollment.aggregate({
        where: { ...base, status: CourseEnrollmentStatus.PAID },
        _sum: { paidAmountCents: true },
      }),
    ]);

    const counts = Object.fromEntries(
      Object.values(CourseEnrollmentStatus).map((status) => [status, 0]),
    ) as Record<CourseEnrollmentStatus, number>;
    for (const row of grouped) {
      counts[row.status] = row._count.status;
    }
    return {
      counts,
      soldRevenueCents: sold._sum.paidAmountCents ?? 0,
      awaitingReviewCents: awaiting._sum.paidAmountCents ?? 0,
    };
  }

  listByUser(userId: string) {
    return this.prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true, coverUrl: true, priceCents: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

function adminFiltersWhere(
  filters: AdminEnrollmentFilters,
): Prisma.CourseEnrollmentWhereInput {
  const search = filters.search?.trim();
  return {
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.authorId ? { course: { authorId: filters.authorId } } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          updatedAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { user: { fullName: { contains: search, mode: 'insensitive' } } },
            { course: { title: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
}
