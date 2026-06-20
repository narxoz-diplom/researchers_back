import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseAuthorDto } from './course-response.dto';

export class CoursePreviewVideoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  lessonId: string;

  @ApiProperty()
  lessonTitle: string;
}

export class CoursePreviewLessonVideoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  orderNumber: number;

  @ApiProperty()
  locked: boolean;
}

export class CoursePreviewLessonDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  orderNumber: number;

  @ApiProperty({
    description: 'False only for the first lesson (free preview)',
  })
  locked: boolean;

  @ApiPropertyOptional({
    description: 'Price in cents; null if not sold separately',
  })
  priceCents?: number;

  @ApiProperty({ type: [CoursePreviewLessonVideoDto] })
  videos: CoursePreviewLessonVideoDto[];
}

export class CoursePreviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty()
  priceCents: number;

  @ApiPropertyOptional()
  coverUrl?: string;

  @ApiProperty({ type: CourseAuthorDto })
  author: CourseAuthorDto;

  @ApiPropertyOptional({ type: CoursePreviewVideoDto })
  previewVideo?: CoursePreviewVideoDto;

  @ApiProperty({ type: [CoursePreviewLessonDto] })
  lessons: CoursePreviewLessonDto[];
}
