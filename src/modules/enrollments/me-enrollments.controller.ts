import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { MyEnrollmentWithCourseDto } from './dto/enrollment-response.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('me')
export class MeEnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('enrollments')
  @ApiOperation({
    summary: 'Enrollment request history for current subscriber',
  })
  @ApiResponse({ status: 200, type: [MyEnrollmentWithCourseDto] })
  listMine(
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<MyEnrollmentWithCourseDto[]> {
    return this.enrollmentsService.listMyEnrollments(user);
  }
}
