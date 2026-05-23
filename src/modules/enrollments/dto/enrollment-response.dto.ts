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

  @ApiPropertyOptional()
  approvedAt?: string;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional({ type: EnrollmentUserDto })
  user?: EnrollmentUserDto;
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

  @ApiPropertyOptional()
  approvedAt?: string;
}
