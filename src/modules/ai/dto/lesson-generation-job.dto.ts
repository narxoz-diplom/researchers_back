import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LlmUsageInfoDto } from './llm-usage.dto';

export class StartLessonGenerationResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ enum: ['processing'] })
  status!: 'processing';
}

export class LessonGenerationJobStatusDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ enum: ['processing', 'completed', 'failed'] })
  status!: 'processing' | 'completed' | 'failed';

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional({ type: LlmUsageInfoDto })
  usage?: LlmUsageInfoDto;

  @ApiPropertyOptional()
  errorCode?: string;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  requestId?: string;

  @ApiPropertyOptional({ enum: ['outline', 'content'] })
  generationPhase?: 'outline' | 'content';

  @ApiPropertyOptional()
  outputFormat?: string;
}
