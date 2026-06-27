import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiModelDto {
  @ApiProperty({ example: 'gemini-2.5-flash' })
  id!: string;

  @ApiProperty({ example: 'Gemini 2.5 Flash' })
  label!: string;

  @ApiProperty({ example: 'google' })
  provider!: string;

  @ApiPropertyOptional({ example: true })
  recommendedForQuality?: boolean;
}

export class AiModelsResponseDto {
  @ApiProperty({ type: [AiModelDto] })
  models!: AiModelDto[];
}
