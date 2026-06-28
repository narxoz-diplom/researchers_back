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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiCommonErrors } from '../../common/decorators/api-error-responses.decorator';
import { AuthorAiSettingsService } from './author-ai-settings.service';
import { AuthorAiSettingsResponseDto } from './dto/ai-settings.dto';
import { UpdateAuthorAiSettingsDto } from './dto/update-ai-settings.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('users/me/ai-settings')
export class MeAiSettingsController {
  constructor(private readonly authorAiSettings: AuthorAiSettingsService) {}

  @Roles(Role.AUTHOR, Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Get author AI settings (no plaintext API key)' })
  @ApiResponse({ status: 200, type: AuthorAiSettingsResponseDto })
  @ApiCommonErrors(401, 403)
  getSettings(
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<AuthorAiSettingsResponseDto> {
    return this.authorAiSettings.getSettings(user.id);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @Patch()
  @ApiOperation({ summary: 'Save Google AI Studio API key for the author' })
  @ApiResponse({ status: 200, type: AuthorAiSettingsResponseDto })
  @ApiCommonErrors(401, 403)
  updateSettings(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdateAuthorAiSettingsDto,
  ): Promise<AuthorAiSettingsResponseDto> {
    return this.authorAiSettings.upsertKey(user.id, dto.apiKey);
  }

  @Roles(Role.AUTHOR, Role.ADMIN)
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove stored author API key' })
  @ApiResponse({ status: 200, type: AuthorAiSettingsResponseDto })
  @ApiCommonErrors(401, 403)
  deleteSettings(
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<AuthorAiSettingsResponseDto> {
    return this.authorAiSettings.deleteKey(user.id);
  }
}
