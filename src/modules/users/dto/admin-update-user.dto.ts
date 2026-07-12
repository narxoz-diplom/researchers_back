import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe', minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
    description: 'Cloudinary secure_url after signed upload',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;
}
