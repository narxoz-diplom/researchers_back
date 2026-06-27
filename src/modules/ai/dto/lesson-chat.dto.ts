import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LessonChatDto {
  @ApiProperty({ example: 'What is the main idea of this lesson?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
