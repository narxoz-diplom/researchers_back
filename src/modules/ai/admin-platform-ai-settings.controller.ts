import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ApiCommonErrors } from '../../common/decorators/api-error-responses.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthorAiSettingsResponseDto } from './dto/ai-settings.dto';
import { UpdateAuthorAiSettingsDto } from './dto/update-ai-settings.dto';
import { PlatformAiSettingsService } from './platform-ai-settings.service';

@ApiTags('admin-ai')
@ApiBearerAuth()
@Controller('admin/ai-settings')
export class AdminPlatformAiSettingsController {
  constructor(private readonly platformAiSettings: PlatformAiSettingsService) {}

  @Roles(Role.ADMIN)
  @Get('subscriber-chat')
  @ApiOperation({
    summary:
      'Get platform Gemini key for subscriber lesson chat (no plaintext)',
  })
  @ApiResponse({ status: 200, type: AuthorAiSettingsResponseDto })
  @ApiCommonErrors(401, 403)
  getSubscriberChatSettings(): Promise<AuthorAiSettingsResponseDto> {
    return this.platformAiSettings.getSubscriberChatSettings();
  }

  @Roles(Role.ADMIN)
  @Patch('subscriber-chat')
  @ApiOperation({
    summary: 'Save platform Gemini key used for subscriber lesson chat',
  })
  @ApiResponse({ status: 200, type: AuthorAiSettingsResponseDto })
  @ApiCommonErrors(401, 403)
  updateSubscriberChatSettings(
    @Body() dto: UpdateAuthorAiSettingsDto,
  ): Promise<AuthorAiSettingsResponseDto> {
    return this.platformAiSettings.upsertSubscriberChatKey(dto.apiKey);
  }

  @Roles(Role.ADMIN)
  @Delete('subscriber-chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove platform subscriber chat Gemini key' })
  @ApiResponse({ status: 200, type: AuthorAiSettingsResponseDto })
  @ApiCommonErrors(401, 403)
  deleteSubscriberChatSettings(): Promise<AuthorAiSettingsResponseDto> {
    return this.platformAiSettings.deleteSubscriberChatKey();
  }
}
