import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';

export class GrantSubscriptionDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: SubscriptionPlan })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @ApiProperty({ minimum: 1, maximum: 365 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays: number;
}
