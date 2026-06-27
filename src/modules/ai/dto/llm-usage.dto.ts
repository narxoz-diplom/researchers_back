import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LlmUsageInfoDto {
  @ApiProperty()
  llmModelId!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  providerModelId!: string;

  @ApiPropertyOptional()
  inputTokens?: number;

  @ApiPropertyOptional()
  outputTokens?: number;

  @ApiPropertyOptional()
  totalTokens?: number;

  @ApiPropertyOptional()
  usageSource?: string;
}
