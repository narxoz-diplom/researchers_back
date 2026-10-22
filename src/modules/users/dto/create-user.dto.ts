import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Account created by an admin: email is treated as verified, authors are pre-approved. */
export class CreateUserDto {
  @ApiProperty({ example: 'colleague@example.com' })
  @Transform(trim)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 2 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ minLength: 8, description: 'Sent to the user by email' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ enum: Role, example: Role.ADMIN })
  @IsEnum(Role)
  role: Role;
}
