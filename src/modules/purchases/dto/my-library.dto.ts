import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LibraryCourseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  coverUrl?: string;

  @ApiPropertyOptional()
  category?: string;
}

export class LibraryLessonDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  courseId: string;

  @ApiProperty()
  courseTitle: string;

  @ApiPropertyOptional()
  coverUrl?: string;
}

export class MyLibraryDto {
  @ApiProperty({ type: [LibraryCourseDto] })
  courses: LibraryCourseDto[];

  @ApiProperty({ type: [LibraryLessonDto] })
  lessons: LibraryLessonDto[];
}
