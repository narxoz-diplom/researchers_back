import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MediaKind } from '../../common/decorators/media-kind.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LessonMediaGuard } from '../../common/guards/lesson-media.guard';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
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
  @UseGuards(OptionalJwtAuthGuard, LessonMediaGuard)
  @MediaKind('material')
  @Get(':id/view')
  @ApiOperation({
    summary: 'View a lesson material in the browser (no download)',
    description:
      'Serves the file inline to an admin, the course author or a student with an approved enrollment. Accepts the bearer token or the `t` media token from GET /lessons/:id. Never cached.',
  })
  @ApiQuery({ name: 't', required: false, description: 'Media token' })
  @ApiResponse({ status: 200, description: 'File bytes, inline' })
  @ApiResponse({ status: 403, description: 'SUBSCRIPTION_REQUIRED' })
  view(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.lessonsService.viewMaterial(id, req, res);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard, LessonMediaGuard)
  @MediaKind('material')
  @Get(':id/html')
  @ApiOperation({
    summary: 'Lesson material rendered as HTML (DOCX only)',
    description: 'Same access rules as /view.',
  })
  @ApiResponse({ status: 200, description: '{ html }' })
  @ApiResponse({ status: 400, description: 'MATERIAL_PREVIEW_UNSUPPORTED' })
  html(@Param('id') id: string): Promise<{ html: string }> {
    return this.lessonsService.renderMaterialHtml(id);
  }

  @UseGuards(LessonOwnerGuard)
  @Get(':id/download')
  @ApiOperation({
    summary: 'Download the original material file (course author / admin)',
    description:
      'Students only view materials on the site; the file itself is for the author and admins.',
  })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: 200, description: 'File bytes' })
  @ApiResponse({ status: 403, description: 'OWNERSHIP_REQUIRED' })
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
