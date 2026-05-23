import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiProperty({ description: 'ISO 8601 UTC' })
  createdAt: string;
}

export class PagedUsersMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class PagedUsersDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: PagedUsersMetaDto })
  meta: PagedUsersMetaDto;
}
