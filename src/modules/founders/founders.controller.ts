import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { CreateFounderDto } from './dto/create-founder.dto';
import { FounderDto } from './dto/founder-response.dto';
import { UpdateFounderDto } from './dto/update-founder.dto';
import { FoundersService } from './founders.service';

@ApiTags('founders')
@Controller('founders')
export class FoundersController {
  constructor(private readonly foundersService: FoundersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Published founders for landing page' })
  @ApiResponse({ status: 200, type: [FounderDto] })
  listPublished(): Promise<FounderDto[]> {
    return this.foundersService.listPublished();
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('all')
  @ApiOperation({ summary: 'All founders (admin)' })
  @ApiResponse({ status: 200, type: [FounderDto] })
  listAll(): Promise<FounderDto[]> {
    return this.foundersService.listAll();
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiOperation({ summary: 'Create founder' })
  @ApiResponse({ status: 201, type: FounderDto })
  create(@Body() dto: CreateFounderDto): Promise<FounderDto> {
    return this.foundersService.create(dto);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  @ApiOperation({ summary: 'Update founder' })
  @ApiResponse({ status: 200, type: FounderDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFounderDto,
  ): Promise<FounderDto> {
    return this.foundersService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete founder' })
  @ApiResponse({ status: 204 })
  delete(@Param('id') id: string): Promise<void> {
    return this.foundersService.delete(id);
  }
}
