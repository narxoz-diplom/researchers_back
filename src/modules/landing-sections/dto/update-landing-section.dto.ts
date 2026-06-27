import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateLandingSectionDto {
  @ApiProperty({
    description:
      'Section description. Use [link text](https://url) for inline links.',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiProperty({
    type: [String],
    description: 'Bullet points. Each may contain [link text](url) markup.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  points: string[];
}
