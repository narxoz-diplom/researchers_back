import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  LESSON_OUTPUT_LANGUAGES,
  SELECTABLE_LLM_MODEL_IDS,
} from '../ai.constants';

const DEPTHS = ['shallow', 'medium', 'deep'] as const;
const AUDIENCES = ['school', 'bachelor', 'pro'] as const;
const OUTPUT_FORMATS = [
  'structured',
  'lecture',
  'seminar',
  'expert_brief',
] as const;
const GENERATION_PHASES = ['outline', 'content'] as const;

export class GenerateLessonContentDto {
  @ApiProperty({ enum: LESSON_OUTPUT_LANGUAGES, example: 'ru' })
  @IsIn([...LESSON_OUTPUT_LANGUAGES])
  language!: (typeof LESSON_OUTPUT_LANGUAGES)[number];

  @ApiProperty({ example: 'Explain neural networks with practical examples.' })
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  brief!: string;

  @ApiProperty({ example: 'gemini-2.5-flash' })
  @IsString()
  @IsIn([...SELECTABLE_LLM_MODEL_IDS])
  llmModelId!: string;

  @ApiPropertyOptional({ enum: DEPTHS, default: 'medium' })
  @IsOptional()
  @IsIn([...DEPTHS])
  depth?: (typeof DEPTHS)[number];

  @ApiPropertyOptional({ enum: AUDIENCES, default: 'bachelor' })
  @IsOptional()
  @IsIn([...AUDIENCES])
  targetAudience?: (typeof AUDIENCES)[number];

  @ApiPropertyOptional({ enum: OUTPUT_FORMATS, default: 'lecture' })
  @IsOptional()
  @IsIn([...OUTPUT_FORMATS])
  outputFormat?: (typeof OUTPUT_FORMATS)[number];

  @ApiPropertyOptional({
    enum: GENERATION_PHASES,
    default: 'content',
    description: 'outline — plan only; content — full lesson text',
  })
  @IsOptional()
  @IsIn([...GENERATION_PHASES])
  phase?: (typeof GENERATION_PHASES)[number];

  @ApiPropertyOptional({
    description: 'Author-edited plan when phase=content after outline step',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  approvedOutline?: string;
}
