import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class AttachVideoDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  cloudinaryPublicId: string;

  @ApiProperty()
  @IsUrl()
  url: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  durationSeconds: number;

  @ApiProperty({ minimum: 1, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderNumber?: number;
}
