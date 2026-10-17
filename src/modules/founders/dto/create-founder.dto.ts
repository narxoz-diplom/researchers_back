import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** http(s) URL or a site-relative path such as /founders/photo.jpg */
const IMAGE_URL_PATTERN = /^(https?:\/\/|\/(?!\/))\S+$/;

export class CreateFounderDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  fullName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  position: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUrl({ require_tld: false })
  videoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Absolute URL or site-relative path' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Matches(IMAGE_URL_PATTERN, { message: 'previewUrl must be a URL or path' })
  previewUrl?: string | null;

  @ApiPropertyOptional({ description: 'Link to the personal page' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUrl()
  @MaxLength(500)
  profileUrl?: string | null;

  @ApiPropertyOptional({ description: 'Long biography for the personal page' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bio?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Photo URLs or site-relative paths for the personal page',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @Matches(IMAGE_URL_PATTERN, {
    each: true,
    message: 'gallery items must be URLs or paths',
  })
  gallery?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNumber?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
