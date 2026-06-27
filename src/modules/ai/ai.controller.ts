import { Body, Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiCommonErrors } from '../../common/decorators/api-error-responses.decorator';
import { AiService } from './ai.service';
import { AiModelsResponseDto } from './dto/ai-model.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Roles(Role.AUTHOR, Role.ADMIN)
  @Get('models')
  @ApiOperation({ summary: 'List selectable LLM models for lesson generation' })
  @ApiResponse({ status: 200, type: AiModelsResponseDto })
  @ApiCommonErrors(401, 403)
  listModels(): AiModelsResponseDto {
    return this.aiService.listModels();
  }
}
