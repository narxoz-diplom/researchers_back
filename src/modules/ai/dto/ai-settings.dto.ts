import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorAiSettingsResponseDto {
  @ApiProperty()
  hasApiKey!: boolean;

  @ApiPropertyOptional({ example: 'ab12' })
  keyHint?: string;
}
