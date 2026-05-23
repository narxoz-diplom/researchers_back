import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto';
import { ListAdminSubscriptionsQueryDto } from './dto/list-admin-subscriptions-query.dto';
import {
  PagedSubscriptionsDto,
  SubscriptionDto,
} from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all subscriptions (admin)' })
  @ApiResponse({ status: 200, type: PagedSubscriptionsDto })
  list(
    @Query() query: ListAdminSubscriptionsQueryDto,
  ): Promise<PagedSubscriptionsDto> {
    return this.subscriptionsService.listAdmin(query);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('grant')
  @ApiOperation({ summary: 'Grant subscription to a user' })
  @ApiResponse({ status: 201, type: SubscriptionDto })
  grant(
    @CurrentUser() admin: JwtPayloadUser,
    @Body() dto: GrantSubscriptionDto,
  ): Promise<SubscriptionDto> {
    return this.subscriptionsService.grant(admin.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke subscription' })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  revoke(@Param('id') id: string): Promise<SubscriptionDto> {
    return this.subscriptionsService.revoke(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/extend')
  @ApiOperation({ summary: 'Extend subscription' })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  extend(
    @Param('id') id: string,
    @Body() dto: ExtendSubscriptionDto,
  ): Promise<SubscriptionDto> {
    return this.subscriptionsService.extend(id, dto);
  }
}
