import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** The amount the admin actually sees on the Kaspi account, replacing what the student declared. */
export class AdjustAmountDto {
  @ApiProperty({
    description:
      'Amount that actually arrived, in tiyn (replaces the declared total)',
    example: 499000,
  })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  receivedAmountCents: number;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'По выписке Kaspi поступило 6 000 ₸',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
