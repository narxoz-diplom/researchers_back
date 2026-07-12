import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SubmitPaymentDto {
  @ApiProperty({
    description: 'Amount the client sent via Kaspi QR, in tiyn (cents)',
    example: 499000,
  })
  @IsInt()
  @Min(1)
  paidAmountCents: number;
}
