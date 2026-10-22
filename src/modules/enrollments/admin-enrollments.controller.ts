import { Controller, Get, Query } from '@nestjs/common';
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
import {
  AdminEnrollmentStatsDto,
  PagedAdminEnrollmentsDto,
  PaymentEnrollmentDto,
} from './dto/enrollment-response.dto';
import {
  AdminEnrollmentFiltersDto,
  ListAdminEnrollmentsQueryDto,
} from './dto/list-admin-enrollments-query.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/enrollments')
export class AdminEnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Enrollment journal: every request with its event history',
    description:
      'Filter by status (PENDING, PAID, UNDERPAID, APPROVED = sold, REJECTED, CANCELLED) and search by student or course. Newest activity first.',
  })
  @ApiResponse({ status: 200, type: PagedAdminEnrollmentsDto })
  list(
    @CurrentUser() user: JwtPayloadUser,
    @Query() query: ListAdminEnrollmentsQueryDto,
  ): Promise<PagedAdminEnrollmentsDto> {
    return this.enrollmentsService.listForAdmin(user, query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Counts per status and revenue of sold courses',
    description: 'Accepts the same author / date / search filters as the list.',
  })
  @ApiResponse({ status: 200, type: AdminEnrollmentStatsDto })
  stats(
    @CurrentUser() user: JwtPayloadUser,
    @Query() query: AdminEnrollmentFiltersDto,
  ): Promise<AdminEnrollmentStatsDto> {
    return this.enrollmentsService.statsForAdmin(user, query);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List Kaspi payments awaiting admin review' })
  @ApiResponse({ status: 200, type: [PaymentEnrollmentDto] })
  listPendingPayments(
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<PaymentEnrollmentDto[]> {
    return this.enrollmentsService.listPendingPayments(user);
  }
}
