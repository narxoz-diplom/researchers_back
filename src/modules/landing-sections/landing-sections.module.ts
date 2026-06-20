import { Module } from '@nestjs/common';
import { LandingSectionsController } from './landing-sections.controller';
import { LandingSectionsService } from './landing-sections.service';

@Module({
  controllers: [LandingSectionsController],
  providers: [LandingSectionsService],
  exports: [LandingSectionsService],
})
export class LandingSectionsModule {}
