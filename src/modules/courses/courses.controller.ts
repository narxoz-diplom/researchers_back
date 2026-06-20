import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CourseOwnerGuard } from '../../common/guards/course-owner.guard';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import {
  CourseDetailDto,
  CourseListItemDto,
  PagedCoursesDto,
} from './dto/course-response.dto';
import { CoursePreviewDto } from './dto/course-preview.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Catalog of published courses' })
  @ApiResponse({ status: 200, type: PagedCoursesDto })
  list(@Query() query: ListCoursesQueryDto): Promise<PagedCoursesDto> {
    return this.coursesService.listCatalog(query);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @Get('mine')
  @ApiOperation({ summary: 'Author courses (all statuses)' })
  @ApiResponse({ status: 200, type: [CourseListItemDto] })
  listMine(@CurrentUser() user: JwtPayloadUser): Promise<CourseListItemDto[]> {
    return this.coursesService.listMine(user);
  }

  @Public()
  @Get(':id/preview')
  @ApiOperation({ summary: 'Public course preview (first video + lesson list)' })
  @ApiResponse({ status: 200, type: CoursePreviewDto })
  @ApiResponse({ status: 404, description: 'Course not found' })
  getPreview(@Param('id') id: string): Promise<CoursePreviewDto> {
    return this.coursesService.getPreview(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Course details with lesson summaries' })
  @ApiResponse({ status: 200, type: CourseDetailDto })
  @ApiResponse({ status: 404, description: 'Course not found' })
  getById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<CourseDetailDto> {
    return this.coursesService.getById(id, user);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiOperation({ summary: 'Create a draft course' })
  @ApiResponse({ status: 201, type: CourseListItemDto })
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateCourseDto,
  ): Promise<CourseListItemDto> {
    return this.coursesService.create(user, dto);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  @ApiOperation({ summary: 'Update course' })
  @ApiResponse({ status: 200, type: CourseListItemDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseListItemDto> {
    return this.coursesService.update(id, dto);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish course' })
  @ApiResponse({ status: 200, type: CourseListItemDto })
  publish(@Param('id') id: string): Promise<CourseListItemDto> {
    return this.coursesService.publish(id);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive course' })
  @ApiResponse({ status: 200, type: CourseListItemDto })
  archive(@Param('id') id: string): Promise<CourseListItemDto> {
    return this.coursesService.archive(id);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/draft')
  @ApiOperation({ summary: 'Revert course to draft' })
  @ApiResponse({ status: 200, type: CourseListItemDto })
  draft(@Param('id') id: string): Promise<CourseListItemDto> {
    return this.coursesService.draft(id);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete course and related media' })
  @ApiResponse({ status: 204 })
  delete(@Param('id') id: string): Promise<void> {
    return this.coursesService.delete(id);
  }
}
