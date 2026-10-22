import { ApiProperty } from '@nestjs/swagger';

export class LandingSectionDto {
  @ApiProperty({ example: 'publication' })
  slug: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [String] })
  points: string[];

  @ApiProperty({ description: 'Kazakh description' })
  descriptionKk: string;

  @ApiProperty({ type: [String], description: 'Kazakh bullet points' })
  pointsKk: string[];

  @ApiProperty()
  updatedAt: Date;
}
