import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
import { LessonsService } from './lessons.service';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(LessonOwnerGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete material' })
  @ApiResponse({ status: 204 })
  delete(@Param('id') id: string): Promise<void> {
    return this.lessonsService.deleteMaterial(id);
  }
}
