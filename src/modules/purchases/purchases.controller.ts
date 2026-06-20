import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { MyLibraryDto } from './dto/my-library.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get('me/library')
  @ApiOperation({
    summary: 'List purchased courses and lessons for current user',
  })
  @ApiResponse({ status: 200, type: MyLibraryDto })
  getMyLibrary(@CurrentUser() user: JwtPayloadUser): Promise<MyLibraryDto> {
    return this.purchasesService.getMyLibrary(user.id);
  }

  @Roles(Role.SUBSCRIBER)
  @HttpCode(HttpStatus.OK)
  @Post('checkout')
  @ApiOperation({ summary: 'Checkout cart items (courses, lessons)' })
  @ApiResponse({ status: 200, type: CheckoutResponseDto })
  checkout(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    return this.purchasesService.checkout(user, dto.items);
  }
}
