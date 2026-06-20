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

  @ApiProperty()
  videoUrl: string;

  @ApiPropertyOptional()
  previewUrl?: string;

  @ApiProperty()
  orderNumber: number;

  @ApiProperty()
  isPublished: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
