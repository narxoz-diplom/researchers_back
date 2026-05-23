import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
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
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { LessonProgressDto } from './dto/progress-response.dto';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('lessons')
export class LessonCompleteController {
  constructor(private readonly progressService: ProgressService) {}

  @UseGuards(SubscriptionGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/complete')
  @ApiOperation({
    summary: 'Mark lesson as completed',
    description: 'Requires content access (subscription, author, or admin).',
  })
  @ApiResponse({ status: 200, type: LessonProgressDto })
  @ApiResponse({ status: 403, description: 'SUBSCRIPTION_REQUIRED' })
  complete(
    @Param('id') lessonId: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<LessonProgressDto> {
    return this.progressService.completeLesson(user.id, lessonId);
  }

  @Delete(':id/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove lesson completion mark' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Progress record not found' })
  async uncomplete(
    @Param('id') lessonId: string,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<void> {
    await this.progressService.uncompleteLesson(user.id, lessonId);
  }
}
