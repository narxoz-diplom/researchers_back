import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
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
  @Transform(({ value }: { value: unknown }): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return typeof value === 'string' ? value : undefined;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl()
  coverUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Price in minor currency units (e.g. 499000 = 4990.00 ₽)',
    default: 499000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;
}
