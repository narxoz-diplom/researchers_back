import {
  CourseEnrollment,
  CourseEnrollmentStatus,
  Prisma,
} from '@prisma/client';

export type EnrollmentWithUser = CourseEnrollment & {
  user: { id: string; email: string; fullName: string };
};

export type EnrollmentWithCourse = CourseEnrollment & {
  course: { id: string; title: string; authorId: string };
};

export type EnrollmentWithUserAndCourse = CourseEnrollment & {
  user: { id: string; email: string; fullName: string };
  course: { id: string; title: string; priceCents: number };
};

export type EnrollmentWithCourseSummary = CourseEnrollment & {
  course: {
    id: string;
    title: string;
    coverUrl: string | null;
    priceCents: number;
  };
};

export interface IEnrollmentsRepository {
  findByCourseAndUser(
    courseId: string,
    userId: string,
  ): Promise<CourseEnrollment | null>;

  findById(id: string): Promise<EnrollmentWithCourse | null>;

  create(data: {
    courseId: string;
    userId: string;
    message?: string;
  }): Promise<CourseEnrollment>;

  update(
    id: string,
    data: Prisma.CourseEnrollmentUpdateInput,
  ): Promise<CourseEnrollment>;

  listByCourse(
    courseId: string,
    status?: CourseEnrollmentStatus,
  ): Promise<EnrollmentWithUser[]>;

  listPendingPayments(): Promise<EnrollmentWithUserAndCourse[]>;

  listByUser(userId: string): Promise<EnrollmentWithCourseSummary[]>;
}
