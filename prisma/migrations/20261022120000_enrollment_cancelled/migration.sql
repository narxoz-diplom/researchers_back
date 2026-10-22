-- A student may withdraw a request or a submitted payment before access is granted.
ALTER TYPE "CourseEnrollmentStatus" ADD VALUE 'CANCELLED';
