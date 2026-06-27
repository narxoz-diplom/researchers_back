import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { LandingSectionDto } from './dto/landing-section-response.dto';
import { UpdateLandingSectionDto } from './dto/update-landing-section.dto';
import { LandingSectionsService } from './landing-sections.service';

@ApiTags('landing-sections')
@Controller('landing-sections')
export class LandingSectionsController {
  constructor(
    private readonly landingSectionsService: LandingSectionsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Landing section descriptions for the home page' })
  @ApiResponse({ status: 200, type: [LandingSectionDto] })
  list(): Promise<LandingSectionDto[]> {
    return this.landingSectionsService.list();
  }

  @Roles(Role.ADMIN, Role.AUTHOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Patch(':slug')
  @ApiOperation({
    summary: 'Update landing section description (author/admin)',
  })
  @ApiResponse({ status: 200, type: LandingSectionDto })
  update(
    @Param('slug') slug: string,
    @Body() dto: UpdateLandingSectionDto,
  ): Promise<LandingSectionDto> {
    return this.landingSectionsService.update(slug, dto);
  }
}
