import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseEnrollmentStatus } from '@prisma/client';

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
