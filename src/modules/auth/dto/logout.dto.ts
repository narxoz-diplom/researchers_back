import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Refresh token to revoke. If omitted, all refresh tokens for the user are removed.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
