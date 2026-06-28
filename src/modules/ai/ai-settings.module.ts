import { Module } from '@nestjs/common';
import { AdminPlatformAiSettingsController } from './admin-platform-ai-settings.controller';
import { AiKeyCryptoService } from './ai-key-crypto.service';
import { AuthorAiSettingsService } from './author-ai-settings.service';
import { MeAiSettingsController } from './me-ai-settings.controller';
import { PlatformAiSettingsService } from './platform-ai-settings.service';

@Module({
  controllers: [MeAiSettingsController, AdminPlatformAiSettingsController],
  providers: [
    AiKeyCryptoService,
    AuthorAiSettingsService,
    PlatformAiSettingsService,
  ],
  exports: [
    AiKeyCryptoService,
    AuthorAiSettingsService,
    PlatformAiSettingsService,
  ],
})
export class AiSettingsModule {}
