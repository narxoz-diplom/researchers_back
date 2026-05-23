import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CourseProgressQueryDto {
  @ApiPropertyOptional({ description: 'Filter progress for a single course' })
  @IsOptional()
  @IsString()
  courseId?: string;
}
