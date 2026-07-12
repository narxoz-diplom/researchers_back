import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestMorePaymentDto {
  @ApiProperty({ example: 'Недостаточная сумма. Доплатите 2000 ₸' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note: string;
}
