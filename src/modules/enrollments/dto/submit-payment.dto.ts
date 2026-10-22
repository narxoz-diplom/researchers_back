import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class SubmitPaymentDto {
  @ApiProperty({
    description:
      'Amount the client sent via Kaspi QR, in tiyn (cents). 0 only for free courses.',
    example: 499000,
  })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  paidAmountCents: number;
}
