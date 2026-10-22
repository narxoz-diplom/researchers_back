import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorStatus } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AuthorApplicationResponseDto {
  @ApiProperty()
  legalName: string;

  @ApiProperty()
  iin: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  offerVersion: string;

  @ApiProperty({ description: 'ISO 8601 UTC' })
  acceptedAt: string;

  @ApiPropertyOptional()
  reviewNote?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC' })
  reviewedAt?: string;
}

export class MyAuthorApplicationDto {
  @ApiProperty({ enum: AuthorStatus })
  status: AuthorStatus;

  @ApiPropertyOptional({ type: AuthorApplicationResponseDto })
  application?: AuthorApplicationResponseDto;
}

export class AdminAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: AuthorStatus })
  status: AuthorStatus;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  coursesCount: number;

  @ApiProperty({ description: 'ISO 8601 UTC' })
  createdAt: string;

  @ApiPropertyOptional({ type: AuthorApplicationResponseDto })
  application?: AuthorApplicationResponseDto;
}

export class RejectAuthorDto {
  @ApiProperty({ example: 'ЖСН қате, қайта тексеріңіз' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note: string;
}
