import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LlmUsageInfoDto } from './llm-usage.dto';

export class LessonChatResponseDto {
  @ApiProperty()
  answer!: string;

  @ApiPropertyOptional({ type: LlmUsageInfoDto })
  usage?: LlmUsageInfoDto;

  @ApiPropertyOptional({ example: 42 })
  remainingMessages?: number;

  @ApiPropertyOptional()
  requestId?: string;
}
