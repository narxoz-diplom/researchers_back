import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CourseEnrollmentStatus,
  EnrollmentEventType,
  Role,
} from '@prisma/client';

export class EnrollmentUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;
}

export class CourseEnrollmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  courseId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: CourseEnrollmentStatus })
  status: CourseEnrollmentStatus;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  paidAt?: string;

  @ApiPropertyOptional({
    description: 'Total amount client reported via Kaspi, in tiyn',
  })
  paidAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Expected course price at checkout, in tiyn',
  })
  expectedAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Admin note when payment is insufficient',
  })
  adminPaymentNote?: string;

  @ApiPropertyOptional()
  approvedAt?: string;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional({ type: EnrollmentUserDto })
  user?: EnrollmentUserDto;
}

export class PaymentEnrollmentDto extends CourseEnrollmentDto {
  @ApiProperty()
  course: { id: string; title: string; priceCents: number };
}

export class EnrollmentEventActorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Role })
  role: Role;
}

/** One line of the enrollment journal. */
export class EnrollmentEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: EnrollmentEventType })
  type: EnrollmentEventType;

  @ApiPropertyOptional({ type: EnrollmentEventActorDto })
  actor?: EnrollmentEventActorDto;

  @ApiPropertyOptional({ description: 'Amount of this payment, in tiyn' })
  amountCents?: number;

  @ApiPropertyOptional({
    description: 'Running total after the event, in tiyn',
  })
  totalPaidCents?: number;

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty()
  createdAt: string;
}

export class AdminEnrollmentDto extends PaymentEnrollmentDto {
  @ApiProperty()
  updatedAt: string;

  @ApiProperty({ type: [EnrollmentEventDto], description: 'Oldest first' })
  events: EnrollmentEventDto[];
}

export class PagedAdminEnrollmentsDto {
  @ApiProperty({ type: [AdminEnrollmentDto] })
  data: AdminEnrollmentDto[];

  @ApiProperty()
  meta: { total: number; page: number; pageSize: number };
}

export class AdminEnrollmentStatsDto {
  @ApiProperty({
    description: 'Number of enrollments per current status',
    example: {
      PENDING: 2,
      PAID: 1,
      UNDERPAID: 0,
      APPROVED: 10,
      REJECTED: 1,
      CANCELLED: 3,
    },
  })
  counts: Record<CourseEnrollmentStatus, number>;

  @ApiProperty({
    description: 'Sum of payments on sold (APPROVED) courses, in tiyn',
  })
  soldRevenueCents: number;

  @ApiProperty({
    description: 'Sum of payments awaiting review (PAID), in tiyn',
  })
  awaitingReviewCents: number;
}

export class MyEnrollmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: CourseEnrollmentStatus })
  status: CourseEnrollmentStatus;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  paidAt?: string;

  @ApiPropertyOptional({
    description: 'Total amount client reported via Kaspi, in tiyn',
  })
  paidAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Expected course price at checkout, in tiyn',
  })
  expectedAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Admin note when payment is insufficient',
  })
  adminPaymentNote?: string;

  @ApiPropertyOptional()
  approvedAt?: string;

  @ApiProperty()
  createdAt: string;
}

export class MyEnrollmentWithCourseDto extends MyEnrollmentDto {
  @ApiProperty()
  course: { id: string; title: string; coverUrl?: string; priceCents: number };
}
