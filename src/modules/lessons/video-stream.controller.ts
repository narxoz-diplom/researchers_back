import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MediaKind } from '../../common/decorators/media-kind.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LessonMediaGuard } from '../../common/guards/lesson-media.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { LessonsService } from './lessons.service';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('videos')
export class VideoStreamController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard, LessonMediaGuard)
  @MediaKind('video')
  @Get(':id/stream')
  @ApiOperation({
    summary: 'Stream an uploaded lesson video to a viewer with access',
    description:
      'Supports HTTP ranges. The viewer is identified by the bearer token or by the `t` media token from GET /lessons/:id (so a <video> tag can play it). The origin URL is never exposed; YouTube videos are embedded by youtubeVideoId instead.',
  })
  @ApiQuery({ name: 't', required: false, description: 'Media token' })
  @ApiResponse({ status: 200, description: 'Video bytes' })
  @ApiResponse({ status: 206, description: 'Partial content' })
  @ApiResponse({ status: 403, description: 'SUBSCRIPTION_REQUIRED' })
  stream(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.lessonsService.streamVideo(id, req, res);
  }
}
