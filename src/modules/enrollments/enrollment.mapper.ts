import { CourseEnrollment } from '@prisma/client';
import { EnrollmentWithUser } from './enrollments.repository.interface';
import { CourseEnrollmentDto, MyEnrollmentDto } from './dto/enrollment-response.dto';

export function toMyEnrollment(
  enrollment: CourseEnrollment,
): MyEnrollmentDto {
  return {
    id: enrollment.id,
    status: enrollment.status,
    ...(enrollment.message ? { message: enrollment.message } : {}),
    ...(enrollment.paidAt
      ? { paidAt: enrollment.paidAt.toISOString() }
      : {}),
    ...(enrollment.approvedAt
      ? { approvedAt: enrollment.approvedAt.toISOString() }
      : {}),
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
    ...(row.paidAt ? { paidAt: row.paidAt.toISOString() } : {}),
    ...(row.approvedAt ? { approvedAt: row.approvedAt.toISOString() } : {}),
    user: row.user,
  };
}
