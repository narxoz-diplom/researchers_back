import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AuthorApplicationDto } from '../../authors/dto/author-application.dto';

export class RegisterDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass1', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 2 })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({
    enum: [Role.SUBSCRIBER, Role.AUTHOR],
    example: Role.SUBSCRIBER,
  })
  @IsIn([Role.SUBSCRIBER, Role.AUTHOR], { message: 'FORBIDDEN_ROLE' })
  role: Role;

  @ApiPropertyOptional({
    type: AuthorApplicationDto,
    description: 'Required for AUTHOR: details of the accepted public offer',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthorApplicationDto)
  authorApplication?: AuthorApplicationDto;
}
