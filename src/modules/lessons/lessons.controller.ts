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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { AttachMaterialDto } from './dto/attach-material.dto';
import { AttachVideoDto } from './dto/attach-video.dto';
import { AttachYoutubeVideoDto } from './dto/attach-youtube-video.dto';
import {
  LessonDetailResponseDto,
  LessonMaterialEntityDto,
  LessonVideoEntityDto,
} from './dto/lesson-response.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @UseGuards(SubscriptionGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Lesson details with content and media',
    description:
      'Requires active subscription for subscribers (403 SUBSCRIPTION_REQUIRED). Course author and ADMIN always have access.',
  })
  @ApiResponse({ status: 200, type: LessonDetailResponseDto })
  @ApiResponse({ status: 403, description: 'SUBSCRIPTION_REQUIRED' })
  getById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<LessonDetailResponseDto> {
    return this.lessonsService.getById(id, user);
  }

  @UseGuards(LessonOwnerGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update lesson' })
  @ApiResponse({ status: 200, type: LessonDetailResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonDetailResponseDto> {
    return this.lessonsService.update(id, dto);
  }

  @UseGuards(LessonOwnerGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete lesson and Cloudinary assets' })
  @ApiResponse({ status: 204 })
  delete(@Param('id') id: string): Promise<void> {
    return this.lessonsService.delete(id);
  }

  @UseGuards(LessonOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/videos')
  @ApiOperation({ summary: 'Attach video after Cloudinary upload' })
  @ApiResponse({ status: 201, type: LessonVideoEntityDto })
  attachVideo(
    @Param('id') lessonId: string,
    @Body() dto: AttachVideoDto,
  ): Promise<LessonVideoEntityDto> {
    return this.lessonsService.attachVideo(lessonId, dto);
  }

  @UseGuards(LessonOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/videos/youtube')
  @ApiOperation({ summary: 'Attach YouTube video by URL' })
  @ApiResponse({ status: 201, type: LessonVideoEntityDto })
  attachYoutubeVideo(
    @Param('id') lessonId: string,
    @Body() dto: AttachYoutubeVideoDto,
  ): Promise<LessonVideoEntityDto> {
    return this.lessonsService.attachYoutubeVideo(lessonId, dto);
  }

  @UseGuards(LessonOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/materials')
  @ApiOperation({ summary: 'Attach material after Cloudinary upload' })
  @ApiResponse({ status: 201, type: LessonMaterialEntityDto })
  attachMaterial(
    @Param('id') lessonId: string,
    @Body() dto: AttachMaterialDto,
  ): Promise<LessonMaterialEntityDto> {
    return this.lessonsService.attachMaterial(lessonId, dto);
  }
}
