import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class AttachYoutubeVideoDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'YouTube video URL (watch, embed, shorts, youtu.be)',
  })
  @IsUrl({ require_tld: false })
  youtubeUrl: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderNumber?: number;
}
