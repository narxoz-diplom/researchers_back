import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { UploadResourceType } from '../media.types';

export class SignUploadDto {
  @ApiProperty({ enum: UploadResourceType })
  @IsEnum(UploadResourceType)
  resourceType: UploadResourceType;

  @ApiProperty({
    example: 'courses/clxxx/lessons/lyyy/videos',
    description:
      'Target folder, e.g. courses/{courseId}/cover or courses/{courseId}/lessons/{lessonId}/videos',
  })
  @IsString()
  @MaxLength(500)
  @Matches(/^(courses|avatars)\/[a-zA-Z0-9/_-]+$/, {
    message:
      'folder must start with courses/ or avatars/ and use safe characters',
  })
  folder: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicId?: string;
}
