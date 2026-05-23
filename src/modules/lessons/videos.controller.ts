import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
import { LessonVideoEntityDto } from './dto/lesson-response.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { LessonsService } from './lessons.service';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(LessonOwnerGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Update video metadata' })
  @ApiResponse({ status: 200, type: LessonVideoEntityDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
  ): Promise<LessonVideoEntityDto> {
    return this.lessonsService.updateVideo(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete video' })
  @ApiResponse({ status: 204 })
  delete(@Param('id') id: string): Promise<void> {
    return this.lessonsService.deleteVideo(id);
  }
}
