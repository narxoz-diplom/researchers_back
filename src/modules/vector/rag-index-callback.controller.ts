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
import { LessonIndexService } from './lesson-index.service';

interface RagCallbackBody {
  task_id?: string;
  status: 'completed' | 'failed' | 'processing';
  result?: { request_id?: string | null };
  error?: string;
}

@ApiExcludeController()
@Controller('rag')
export class RagIndexCallbackController {
  constructor(
    private readonly lessonIndexService: LessonIndexService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('index-callback')
  async handleCallback(
    @Query('jobId') jobId: string | undefined,
    @Query('taskKey') taskKey: string | undefined,
    @Query('secret') secret: string | undefined,
    @Body() body: RagCallbackBody,
  ): Promise<{ status: string }> {
    const expectedSecret = this.configService
      .get<string>('RAG_CALLBACK_SECRET')
      ?.trim();
    if (!expectedSecret || secret !== expectedSecret) {
      throw new BadRequestException('Invalid callback secret');
    }
    if (!jobId?.trim() || !taskKey?.trim()) {
      throw new BadRequestException('jobId and taskKey are required');
    }
    if (body.status === 'processing') {
      return { status: 'ignored' };
    }

    await this.lessonIndexService.handleRagCallback({
      jobId: jobId.trim(),
      taskKey: taskKey.trim(),
      payload: body,
    });

    return { status: 'ok' };
  }
}
