import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUrl, Min } from 'class-validator';

export class AttachMaterialDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  cloudinaryPublicId: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty({ minimum: 1, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  sizeBytes: number;
}
