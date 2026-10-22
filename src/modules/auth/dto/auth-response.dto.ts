import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorStatus, Role } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiPropertyOptional({
    enum: AuthorStatus,
    description: 'Admin review of the author offer (authors only)',
  })
  authorStatus?: AuthorStatus;

  @ApiPropertyOptional()
  avatarUrl?: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
