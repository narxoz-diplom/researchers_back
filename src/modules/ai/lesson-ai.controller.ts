import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiCommonErrors } from '../../common/decorators/api-error-responses.decorator';
import { LessonOwnerGuard } from '../../common/guards/lesson-owner.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { AiService } from './ai.service';
import { GenerateLessonContentDto } from './dto/generate-lesson-content.dto';
import {
  LessonGenerationJobStatusDto,
  StartLessonGenerationResponseDto,
} from './dto/lesson-generation-job.dto';
import { LessonChatDto } from './dto/lesson-chat.dto';
import { LessonChatResponseDto } from './dto/lesson-chat-response.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('lessons')
export class LessonAiController {
  constructor(private readonly aiService: AiService) {}

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @Post(':id/generate')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Start async lesson content generation via RAG (author BYOK)',
    description:
      'Returns a job id immediately. Poll GET /lessons/:id/generate/jobs/:jobId until completed.',
  })
  @ApiResponse({ status: 202, type: StartLessonGenerationResponseDto })
  @ApiCommonErrors(401, 403, 404)
  startLessonGeneration(
    @Param('id') lessonId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: GenerateLessonContentDto,
  ): Promise<StartLessonGenerationResponseDto> {
    return this.aiService.startLessonGeneration(user.id, lessonId, dto);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @Get(':id/generate/latest')
  @ApiOperation({
    summary: 'Latest async lesson generation job for this lesson',
  })
  @ApiResponse({ status: 200, type: LessonGenerationJobStatusDto })
  @ApiCommonErrors(401, 403, 404)
  getLatestLessonGenerationJob(
    @Param('id') lessonId: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<LessonGenerationJobStatusDto | null> {
    return this.aiService.getLatestLessonGenerationJob(user.id, lessonId);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @Get(':id/generate/jobs/:jobId')
  @ApiOperation({ summary: 'Poll async lesson generation job status' })
  @ApiResponse({ status: 200, type: LessonGenerationJobStatusDto })
  @ApiCommonErrors(401, 403, 404)
  getLessonGenerationJob(
    @Param('id') lessonId: string,
    @Param('jobId') jobId: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<LessonGenerationJobStatusDto> {
    return this.aiService.getLessonGenerationJob(user.id, lessonId, jobId);
  }

  @Roles(Role.SUBSCRIBER)
  @UseGuards(SubscriptionGuard)
  @Post(':id/chat')
  @ApiOperation({
    summary: 'Lesson-scoped AI chat for subscribers',
    description:
      'Answers only from the open lesson context. Enforces monthly chat quota.',
  })
  @ApiResponse({ status: 200, type: LessonChatResponseDto })
  @ApiResponse({
    status: 403,
    description: 'SUBSCRIPTION_REQUIRED | CHAT_LIMIT_EXCEEDED',
  })
  @ApiCommonErrors(401, 404)
  chatOnLesson(
    @Param('id') lessonId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: LessonChatDto,
  ): Promise<LessonChatResponseDto> {
    return this.aiService.chatOnLesson(user.id, lessonId, dto);
  }
}
