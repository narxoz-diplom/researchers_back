import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MaterialAccessGuard } from '../../common/guards/material-access.guard';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { LessonsService } from './lessons.service';

function contentDispositionAttachment(filename: string): string {
  const asciiFallback =
    filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('materials')
export class MaterialsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard, MaterialAccessGuard)
  @Get(':id/download')
  @ApiOperation({
    summary: 'Download lesson material file',
    description:
      'Streams the file with Content-Disposition attachment. Public for lessons available to everyone.',
  })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: 200, description: 'File bytes' })
  @ApiResponse({ status: 403, description: 'SUBSCRIPTION_REQUIRED' })
  async download(@Param('id') id: string): Promise<StreamableFile> {
    const { buffer, filename, mimeType } =
      await this.lessonsService.downloadMaterial(id);

    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: contentDispositionAttachment(filename),
    });
  }

  @UseGuards(LessonOwnerGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete material' })
  @ApiResponse({ status: 204 })
  delete(@Param('id') id: string): Promise<void> {
    return this.lessonsService.deleteMaterial(id);
  }
}
