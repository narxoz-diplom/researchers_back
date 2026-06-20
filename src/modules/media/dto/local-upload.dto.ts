import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { UploadResourceType } from '../media.types';

export class LocalUploadDto {
  @ApiProperty({ enum: UploadResourceType })
  @IsEnum(UploadResourceType)
  resourceType: UploadResourceType;

  @ApiProperty({ example: 'courses/clxxx/cover' })
  @IsString()
  @MaxLength(500)
  @Matches(/^(courses|avatars|founders)\/[a-zA-Z0-9/_-]+$/, {
    message:
      'folder must start with courses/, avatars/, or founders/ and use safe characters',
  })
  folder: string;
}
