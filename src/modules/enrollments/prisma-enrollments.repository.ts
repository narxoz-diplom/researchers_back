import { Injectable } from '@nestjs/common';
import { CourseEnrollmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EnrollmentWithCourse,
  EnrollmentWithUser,
  IEnrollmentsRepository,
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
