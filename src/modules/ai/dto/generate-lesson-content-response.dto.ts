import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LlmUsageInfoDto } from './llm-usage.dto';

export class GenerateLessonContentResponseDto {
  @ApiProperty()
  content!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional({ type: LlmUsageInfoDto })
  usage?: LlmUsageInfoDto;

  @ApiPropertyOptional()
  requestId?: string;
}
