import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthorStatus, Role } from '@prisma/client';
import { AllowPendingAuthor } from '../../common/decorators/allow-pending-author.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthorsService } from './authors.service';
import { AuthorApplicationDto } from './dto/author-application.dto';
import {
  AdminAuthorDto,
  MyAuthorApplicationDto,
  RejectAuthorDto,
} from './dto/author-response.dto';

@ApiTags('authors')
@ApiBearerAuth()
@Controller('me/author-application')
@Roles(Role.AUTHOR)
@AllowPendingAuthor()
export class MeAuthorApplicationController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  @ApiOperation({ summary: 'Status of my author offer' })
  @ApiResponse({ status: 200, type: MyAuthorApplicationDto })
  getMine(
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<MyAuthorApplicationDto> {
    return this.authorsService.getMine(user);
  }

  @Put()
  @ApiOperation({
    summary: 'Update the offer while under review, or resubmit after rejection',
  })
  @ApiResponse({ status: 200, type: MyAuthorApplicationDto })
  resubmit(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: AuthorApplicationDto,
  ): Promise<MyAuthorApplicationDto> {
    return this.authorsService.resubmit(user, dto);
  }
}

@ApiTags('authors')
@ApiBearerAuth()
@Controller('admin/authors')
@Roles(Role.ADMIN)
export class AdminAuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  @ApiOperation({ summary: 'Authors with their offers (filter by status)' })
  @ApiQuery({ name: 'status', required: false, enum: AuthorStatus })
  @ApiResponse({ status: 200, type: [AdminAuthorDto] })
  list(
    @Query('status', new ParseEnumPipe(AuthorStatus, { optional: true }))
    status?: AuthorStatus,
  ): Promise<AdminAuthorDto[]> {
    return this.authorsService.listForAdmin(status);
  }

  @Post(':userId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve the author offer: courses become editable',
  })
  @ApiResponse({ status: 200, type: AdminAuthorDto })
  approve(
    @CurrentUser() admin: JwtPayloadUser,
    @Param('userId') userId: string,
  ): Promise<AdminAuthorDto> {
    return this.authorsService.approve(admin, userId);
  }

  @Post(':userId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject (or revoke) the author with a note' })
  @ApiResponse({ status: 200, type: AdminAuthorDto })
  reject(
    @CurrentUser() admin: JwtPayloadUser,
    @Param('userId') userId: string,
    @Body() dto: RejectAuthorDto,
  ): Promise<AdminAuthorDto> {
    return this.authorsService.reject(admin, userId, dto.note);
  }
}
