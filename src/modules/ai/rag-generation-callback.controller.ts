import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { LessonGenerationService } from './lesson-generation.service';
import type { RagGenerateSingleLessonResponse } from '../vector/rag-client.types';

interface RagGenerationCallbackBody {
  task_id?: string;
  status: 'completed' | 'failed' | 'processing';
  result?: RagGenerateSingleLessonResponse;
  error?: string;
}

@ApiExcludeController()
@Controller('rag')
export class RagGenerationCallbackController {
  constructor(
    private readonly lessonGenerationService: LessonGenerationService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('generation-callback')
  async handleCallback(
    @Query('jobId') jobId: string | undefined,
    @Query('secret') secret: string | undefined,
    @Body() body: RagGenerationCallbackBody,
  ): Promise<{ status: string }> {
    const expectedSecret = this.configService
      .get<string>('RAG_CALLBACK_SECRET')
      ?.trim();
    if (!expectedSecret || secret !== expectedSecret) {
      throw new BadRequestException('Invalid callback secret');
    }
    if (!jobId?.trim()) {
      throw new BadRequestException('jobId is required');
    }
    if (body.status === 'processing') {
      return { status: 'ignored' };
    }

    await this.lessonGenerationService.handleRagCallback({
      jobId: jobId.trim(),
      payload: body,
    });

    return { status: 'ok' };
  }
}
