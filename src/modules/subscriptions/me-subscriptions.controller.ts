import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionDto } from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('me')
export class MeSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('subscription')
  @ApiOperation({ summary: 'Current active subscription or null' })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  async getActive(
    @CurrentUser() user: JwtPayloadUser,
    @Res() res: Response,
  ): Promise<void> {
    const subscription = await this.subscriptionsService.getMyActive(user.id);
    res.status(200).json(subscription);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Subscription history for current user' })
  @ApiResponse({ status: 200, type: [SubscriptionDto] })
  getHistory(@CurrentUser() user: JwtPayloadUser): Promise<SubscriptionDto[]> {
    return this.subscriptionsService.getMyHistory(user.id);
  }
}
