import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateAuthorAiSettingsDto {
  @ApiProperty({
    description: 'Google AI Studio API key (never returned in responses)',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  apiKey!: string;
}
