import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
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
import { CourseOwnerGuard } from '../../common/guards/course-owner.guard';
import {
  CourseEnrollmentDto,
  MyEnrollmentDto,
} from './dto/enrollment-response.dto';
import { RequestEnrollmentDto } from './dto/request-enrollment.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { RequestMorePaymentDto } from './dto/request-more-payment.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('courses/:courseId/enrollments')
export class CourseEnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Roles(Role.SUBSCRIBER)
  @HttpCode(HttpStatus.CREATED)
  @Post('request')
  @ApiOperation({ summary: 'Request enrollment in a course' })
  @ApiResponse({ status: 201, type: MyEnrollmentDto })
  request(
    @Param('courseId') courseId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: RequestEnrollmentDto,
  ): Promise<MyEnrollmentDto> {
    return this.enrollmentsService.request(courseId, user, dto);
  }

  @Roles(Role.SUBSCRIBER)
  @HttpCode(HttpStatus.OK)
  @Post('purchase')
  @ApiOperation({ summary: 'Submit Kaspi QR payment for review' })
  @ApiResponse({ status: 200, type: MyEnrollmentDto })
  purchase(
    @Param('courseId') courseId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: SubmitPaymentDto,
  ): Promise<MyEnrollmentDto> {
    return this.enrollmentsService.purchase(courseId, user, dto);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @Get()
  @ApiOperation({ summary: 'List enrollment requests for a course (author)' })
  @ApiResponse({ status: 200, type: [CourseEnrollmentDto] })
  list(
    @Param('courseId') courseId: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<CourseEnrollmentDto[]> {
    return this.enrollmentsService.listForCourse(courseId, user);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':enrollmentId/approve')
  @ApiOperation({ summary: 'Grant access after purchase' })
  @ApiResponse({ status: 200, type: CourseEnrollmentDto })
  approve(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<CourseEnrollmentDto> {
    return this.enrollmentsService.approve(courseId, enrollmentId, user);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':enrollmentId/request-more')
  @ApiOperation({ summary: 'Request additional payment from subscriber' })
  @ApiResponse({ status: 200, type: CourseEnrollmentDto })
  requestMore(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: RequestMorePaymentDto,
  ): Promise<CourseEnrollmentDto> {
    return this.enrollmentsService.requestMorePayment(
      courseId,
      enrollmentId,
      user,
      dto,
    );
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':enrollmentId/reject')
  @ApiOperation({ summary: 'Reject enrollment request' })
  @ApiResponse({ status: 200, type: CourseEnrollmentDto })
  reject(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<CourseEnrollmentDto> {
    return this.enrollmentsService.reject(courseId, enrollmentId, user);
  }
}
