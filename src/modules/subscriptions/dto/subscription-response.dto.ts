import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export class SubscriptionUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;
}

export class SubscriptionGrantedByDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;
}

export class SubscriptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: SubscriptionUserDto })
  user: SubscriptionUserDto;

  @ApiProperty({ enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  expiresAt: string;

  @ApiProperty({ type: SubscriptionGrantedByDto })
  grantedBy: SubscriptionGrantedByDto;

  @ApiProperty()
  isActive: boolean;
}

export class PagedSubscriptionsDto {
  @ApiProperty({ type: [SubscriptionDto] })
  data: SubscriptionDto[];

  @ApiProperty()
  meta: { total: number; page: number; pageSize: number };
}
