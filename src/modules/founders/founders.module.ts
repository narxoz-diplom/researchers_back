import { Module } from '@nestjs/common';
import { FoundersController } from './founders.controller';
import { FoundersService } from './founders.service';

@Module({
  controllers: [FoundersController],
  providers: [FoundersService],
  exports: [FoundersService],
})
export class FoundersModule {}
