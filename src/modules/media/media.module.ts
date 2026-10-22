import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaStreamService } from './media-stream.service';
import { MediaTokenService } from './media-token.service';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaTokenService, MediaStreamService],
  exports: [MediaService, MediaTokenService, MediaStreamService],
})
export class MediaModule {}
