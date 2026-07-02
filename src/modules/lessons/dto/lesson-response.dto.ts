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

  @ApiProperty()
  url: string;

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

  @ApiProperty()
  url: string;

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
