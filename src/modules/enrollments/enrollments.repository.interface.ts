import {
  CourseEnrollment,
  CourseEnrollmentEvent,
  CourseEnrollmentStatus,
  Prisma,
  Role,
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

export type EnrollmentEventWithActor = CourseEnrollmentEvent & {
  actor: { id: string; fullName: string; role: Role } | null;
};

export type AdminEnrollmentRow = EnrollmentWithUserAndCourse & {
  events: EnrollmentEventWithActor[];
};

export interface AdminEnrollmentFilters {
  search?: string;
  courseId?: string;
  authorId?: string;
  /** Inclusive bounds on the enrollment's last activity (updatedAt). */
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ListAdminEnrollmentsParams extends AdminEnrollmentFilters {
  status?: CourseEnrollmentStatus;
  page: number;
  pageSize: number;
}

export interface AdminEnrollmentStats {
  counts: Record<CourseEnrollmentStatus, number>;
  soldRevenueCents: number;
  awaitingReviewCents: number;
}

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

  listForAdmin(
    params: ListAdminEnrollmentsParams,
  ): Promise<{ data: AdminEnrollmentRow[]; total: number }>;

  statsForAdmin(filters: AdminEnrollmentFilters): Promise<AdminEnrollmentStats>;

  listByUser(userId: string): Promise<EnrollmentWithCourseSummary[]>;
}
