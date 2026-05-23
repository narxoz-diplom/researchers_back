import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UploadResourceType } from '../media.types';

export class SignResponseDto {
  @ApiProperty()
  cloudName: string;

  @ApiProperty({ description: 'Cloudinary API key (not the secret)' })
  apiKey: string;

  @ApiProperty()
  timestamp: number;

  @ApiProperty()
  signature: string;

  @ApiProperty()
  folder: string;

  @ApiProperty({ enum: UploadResourceType })
  resourceType: UploadResourceType;

  @ApiPropertyOptional()
  publicId?: string;
}
