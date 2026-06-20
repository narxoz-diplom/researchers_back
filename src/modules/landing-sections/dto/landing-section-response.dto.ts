import { ApiProperty } from '@nestjs/swagger';

export class LandingSectionDto {
  @ApiProperty({ example: 'publication' })
  slug: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [String] })
  points: string[];

  @ApiProperty()
  updatedAt: Date;
}
