import { ApiProperty } from '@nestjs/swagger';
import { CheckoutItemType } from './checkout.dto';

export class CheckoutResultItemDto {
  @ApiProperty({ enum: CheckoutItemType })
  type: CheckoutItemType;

  @ApiProperty()
  id: string;

  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  message?: string;
}

export class CheckoutResponseDto {
  @ApiProperty({ type: [CheckoutResultItemDto] })
  results: CheckoutResultItemDto[];
}
