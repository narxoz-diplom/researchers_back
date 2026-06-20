import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  COURSE_SECTION_CATEGORIES,
  type CourseSectionCategory,
} from '../../../common/constants/course-categories';

export class ListCoursesQueryDto {
  @ApiPropertyOptional({ description: 'Search in title and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: COURSE_SECTION_CATEGORIES,
    description: 'Filter by landing section category',
  })
  @IsOptional()
  @IsIn(COURSE_SECTION_CATEGORIES)
  category?: CourseSectionCategory;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
