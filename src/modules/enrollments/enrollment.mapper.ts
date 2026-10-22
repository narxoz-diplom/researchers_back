import {
  AdminEnrollmentRow,
  EnrollmentEventWithActor,
  EnrollmentWithUser,
  EnrollmentWithUserAndCourse,
  EnrollmentWithCourseSummary,
} from './enrollments.repository.interface';
import {
  AdminEnrollmentDto,
  CourseEnrollmentDto,
  EnrollmentEventDto,
  MyEnrollmentDto,
  MyEnrollmentWithCourseDto,
  PaymentEnrollmentDto,
} from './dto/enrollment-response.dto';
import { CourseEnrollment } from '@prisma/client';

function paymentFields(enrollment: CourseEnrollment) {
  return {
    ...(enrollment.paidAt ? { paidAt: enrollment.paidAt.toISOString() } : {}),
    ...(enrollment.paidAmountCents != null
      ? { paidAmountCents: enrollment.paidAmountCents }
      : {}),
    ...(enrollment.expectedAmountCents != null
      ? { expectedAmountCents: enrollment.expectedAmountCents }
      : {}),
    ...(enrollment.adminPaymentNote
      ? { adminPaymentNote: enrollment.adminPaymentNote }
      : {}),
  };
}

export function toMyEnrollment(enrollment: CourseEnrollment): MyEnrollmentDto {
  return {
    id: enrollment.id,
    status: enrollment.status,
    createdAt: enrollment.createdAt.toISOString(),
    ...(enrollment.message ? { message: enrollment.message } : {}),
    ...paymentFields(enrollment),
    ...(enrollment.approvedAt
      ? { approvedAt: enrollment.approvedAt.toISOString() }
      : {}),
  };
}

export function toMyEnrollmentWithCourseDto(
  row: EnrollmentWithCourseSummary,
): MyEnrollmentWithCourseDto {
  return {
    ...toMyEnrollment(row),
    course: {
      id: row.course.id,
      title: row.course.title,
      priceCents: row.course.priceCents,
      ...(row.course.coverUrl ? { coverUrl: row.course.coverUrl } : {}),
    },
  };
}

export function toCourseEnrollmentDto(
  row: EnrollmentWithUser,
): CourseEnrollmentDto {
  return {
    id: row.id,
    courseId: row.courseId,
    userId: row.userId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    ...(row.message ? { message: row.message } : {}),
    ...paymentFields(row),
    ...(row.approvedAt ? { approvedAt: row.approvedAt.toISOString() } : {}),
    user: row.user,
  };
}

export function toPaymentEnrollmentDto(
  row: EnrollmentWithUserAndCourse,
): PaymentEnrollmentDto {
  return {
    ...toCourseEnrollmentDto(row),
    course: {
      id: row.course.id,
      title: row.course.title,
      priceCents: row.course.priceCents,
    },
  };
}

export function toEnrollmentEventDto(
  event: EnrollmentEventWithActor,
): EnrollmentEventDto {
  return {
    id: event.id,
    type: event.type,
    ...(event.actor ? { actor: event.actor } : {}),
    ...(event.amountCents != null ? { amountCents: event.amountCents } : {}),
    ...(event.totalPaidCents != null
      ? { totalPaidCents: event.totalPaidCents }
      : {}),
    ...(event.note ? { note: event.note } : {}),
    createdAt: event.createdAt.toISOString(),
  };
}

export function toAdminEnrollmentDto(
  row: AdminEnrollmentRow,
): AdminEnrollmentDto {
  return {
    ...toPaymentEnrollmentDto(row),
    updatedAt: row.updatedAt.toISOString(),
    events: row.events.map(toEnrollmentEventDto),
  };
}
