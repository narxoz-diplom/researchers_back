import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FounderDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  position: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  videoUrl?: string;

  @ApiPropertyOptional()
  previewUrl?: string;

  @ApiPropertyOptional()
  profileUrl?: string;

  @ApiPropertyOptional()
  bio?: string;

  @ApiProperty({ type: [String] })
  gallery: string[];

  @ApiProperty()
  orderNumber: number;

  @ApiProperty()
  isPublished: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
