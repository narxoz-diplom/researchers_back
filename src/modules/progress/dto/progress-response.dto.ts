import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LessonProgressDto {
  @ApiProperty()
  lessonId: string;

  @ApiProperty({ description: 'ISO 8601 UTC' })
  completedAt: string;
}

export class CourseProgressDto {
  @ApiProperty()
  courseId: string;

  @ApiProperty()
  totalLessons: number;

  @ApiProperty()
  completedLessons: number;

  @ApiProperty({ description: '0–100, rounded down' })
  percentage: number;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC' })
  lastCompletedAt?: string;

  @ApiPropertyOptional({ type: [LessonProgressDto] })
  lessons?: LessonProgressDto[];
}
