import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const compact = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value;

/** Details an author fills in when accepting the public offer. */
export class AuthorApplicationDto {
  @ApiProperty({
    example: 'Иванова Айгерим Серікқызы',
    description: 'Full name or sole proprietor (ИП) name as in the offer',
  })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  legalName: string;

  @ApiProperty({ example: '900101400123', description: 'ИИН / БИН, 12 digits' })
  @Transform(compact)
  @Matches(/^\d{12}$/, { message: 'INVALID_IIN' })
  iin: string;

  @ApiProperty({ example: '+7 701 123 45 67' })
  @Transform(trim)
  @Matches(/^\+?[\d\s()-]{10,20}$/, { message: 'INVALID_PHONE' })
  phone: string;

  @ApiProperty({ example: 'Алматы' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city: string;

  @ApiProperty({
    example: true,
    description: 'Must be true: the offer is accepted',
  })
  @IsBoolean()
  @Equals(true, { message: 'OFFER_NOT_ACCEPTED' })
  acceptOffer: boolean;
}
