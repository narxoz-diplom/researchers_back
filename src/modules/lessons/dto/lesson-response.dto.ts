import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonVectorIndexStatus, VideoSource } from '@prisma/client';

export class LessonSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  orderNumber: number;

  @ApiProperty()
  isPublished: boolean;
}

export class LessonVideoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: VideoSource })
  source: VideoSource;

  @ApiPropertyOptional({
    description:
      'Origin URL (Cloudinary file or YouTube watch link). Only for the course author and admins.',
  })
  url?: string;

  @ApiPropertyOptional({
    description:
      'API path (relative to the base URL) that streams the file to this viewer; the embedded token expires in a few hours. Absent for YouTube videos, which are embedded by youtubeVideoId.',
  })
  streamUrl?: string;

  @ApiPropertyOptional()
  youtubeVideoId?: string;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  orderNumber: number;

  @ApiPropertyOptional()
  sizeBytes?: string;
}

export class LessonMaterialResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({
    description: 'Origin URL. Only for the course author and admins.',
  })
  url?: string;

  @ApiProperty({
    description:
      'API path that serves the file inline (Content-Disposition: inline) to a viewer with access.',
  })
  viewUrl: string;

  @ApiPropertyOptional({
    description: 'API path that returns the document as HTML (DOCX only).',
  })
  htmlUrl?: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: string;
}

export class LessonDetailResponseDto extends LessonSummaryResponseDto {
  @ApiProperty()
  courseId: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [LessonVideoResponseDto] })
  videos: LessonVideoResponseDto[];

  @ApiProperty({ type: [LessonMaterialResponseDto] })
  materials: LessonMaterialResponseDto[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({ enum: LessonVectorIndexStatus })
  vectorIndexStatus: LessonVectorIndexStatus;

  @ApiPropertyOptional()
  vectorIndexJobId?: string | null;

  @ApiPropertyOptional()
  vectorIndexedAt?: string | null;

  @ApiPropertyOptional()
  vectorIndexErrorId?: string | null;

  @ApiPropertyOptional()
  vectorIndexErrorCode?: string | null;
}

export class LessonVideoEntityDto extends LessonVideoResponseDto {
  @ApiProperty()
  lessonId: string;

  @ApiPropertyOptional()
  cloudinaryPublicId?: string;
}

export class LessonMaterialEntityDto extends LessonMaterialResponseDto {
  @ApiProperty()
  lessonId: string;

  @ApiProperty()
  cloudinaryPublicId: string;

  @ApiPropertyOptional()
  createdAt?: string;
}
