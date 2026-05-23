import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus } from '@prisma/client';

export class CourseAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;
}

export class LessonVideoSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  orderNumber: number;
}

export class LessonMaterialSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  mimeType: string;
}

export class LessonSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  orderNumber: number;

  @ApiPropertyOptional({
    description: 'Omitted when the user has no content access',
  })
  content?: string;

  @ApiPropertyOptional({ type: [LessonVideoSummaryDto] })
  videos?: LessonVideoSummaryDto[];

  @ApiPropertyOptional({ type: [LessonMaterialSummaryDto] })
  materials?: LessonMaterialSummaryDto[];
}

export class CourseListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  coverUrl?: string;

  @ApiProperty({ enum: CourseStatus })
  status: CourseStatus;

  @ApiProperty({ type: CourseAuthorDto })
  author: CourseAuthorDto;

  @ApiProperty()
  lessonsCount: number;

  @ApiProperty()
  createdAt: string;
}

export class CourseDetailDto extends CourseListItemDto {
  @ApiProperty({ type: [LessonSummaryDto] })
  lessons: LessonSummaryDto[];

  @ApiProperty({
    description:
      'True for ADMIN, course author, or subscriber with an active subscription',
  })
  hasAccess: boolean;
}

export class PagedCoursesDto {
  @ApiProperty({ type: [CourseListItemDto] })
  data: CourseListItemDto[];

  @ApiProperty()
  meta: { total: number; page: number; pageSize: number };
}
