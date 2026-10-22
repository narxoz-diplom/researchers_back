import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourseEnrollmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Filters shared by the journal list and its stats. */
export class AdminEnrollmentFiltersDto {
  @ApiPropertyOptional({ description: 'Student email / name or course title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Only courses of this author' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Last activity on or after this date (YYYY-MM-DD or ISO 8601)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    description:
      'Last activity on or before this date (a date-only value covers the whole day)',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}

export class ListAdminEnrollmentsQueryDto extends AdminEnrollmentFiltersDto {
  @ApiPropertyOptional({ enum: CourseEnrollmentStatus })
  @IsOptional()
  @IsEnum(CourseEnrollmentStatus)
  status?: CourseEnrollmentStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
