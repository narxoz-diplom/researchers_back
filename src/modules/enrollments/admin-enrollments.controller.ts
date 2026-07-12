import { Controller, Get } from '@nestjs/common';
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
import { PaymentEnrollmentDto } from './dto/enrollment-response.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('admin/enrollments')
export class AdminEnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Roles(Role.ADMIN)
  @Get('payments')
  @ApiOperation({ summary: 'List Kaspi payments awaiting admin review' })
  @ApiResponse({ status: 200, type: [PaymentEnrollmentDto] })
  listPendingPayments(
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<PaymentEnrollmentDto[]> {
    return this.enrollmentsService.listPendingPayments(user);
  }
}
