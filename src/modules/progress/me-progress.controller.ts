import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { CourseProgressQueryDto } from './dto/course-progress-query.dto';
import { CourseProgressDto } from './dto/progress-response.dto';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('me')
export class MeProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('progress')
  @ApiOperation({ summary: 'User progress by course(s)' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiResponse({ status: 200, type: CourseProgressDto, isArray: true })
  getProgress(
    @CurrentUser() user: JwtPayloadUser,
    @Query() query: CourseProgressQueryDto,
  ): Promise<CourseProgressDto | CourseProgressDto[]> {
    return this.progressService.getMyProgress(user.id, query.courseId);
  }
}
