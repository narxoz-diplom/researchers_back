import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CourseOwnerGuard } from '../../common/guards/course-owner.guard';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { OptionalUser } from '../../common/decorators/optional-user.decorator';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  LessonDetailResponseDto,
  LessonSummaryResponseDto,
} from './dto/lesson-response.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { LessonsService } from './lessons.service';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('courses/:courseId/lessons')
export class CourseLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'List lessons (titles and order only)',
    description:
      'Published lessons are visible without login. Full content via GET /lessons/:id.',
  })
  @ApiResponse({ status: 200, type: [LessonSummaryResponseDto] })
  list(
    @Param('courseId') courseId: string,
    @OptionalUser() user: JwtPayloadUser | null,
  ): Promise<LessonSummaryResponseDto[]> {
    return this.lessonsService.listByCourse(courseId, user);
  }

  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiOperation({ summary: 'Create lesson' })
  @ApiResponse({ status: 201, type: LessonDetailResponseDto })
  @ApiResponse({ status: 409, description: 'Duplicate orderNumber' })
  create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateLessonDto,
  ): Promise<LessonDetailResponseDto> {
    return this.lessonsService.create(courseId, dto);
  }

  @UseGuards(LessonOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder lessons in a course' })
  @ApiResponse({ status: 200, type: [LessonSummaryResponseDto] })
  reorder(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderLessonsDto,
  ): Promise<LessonSummaryResponseDto[]> {
    return this.lessonsService.reorder(courseId, dto);
  }
}
