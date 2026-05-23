import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Cover image URL (Cloudinary secure_url or any public image).',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl()
  coverUrl?: string | null;
}
