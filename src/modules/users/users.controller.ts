import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PagedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  getMe(@CurrentUser() user: JwtPayloadUser): Promise<UserResponseDto> {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Avatar URL is stored after the client uploads to Cloudinary via signed upload.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  updateMe(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateMe(user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change current user password',
    description:
      'JWT claims (including role) are updated only after a new login.',
  })
  @ApiResponse({ status: 204 })
  changePassword(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List users (admin)' })
  @ApiResponse({ status: 200, type: PagedUsersDto })
  list(@Query() query: ListUsersQueryDto): Promise<PagedUsersDto> {
    return this.usersService.listUsers(query);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get user by id (admin)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  getById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.getById(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/role')
  @ApiOperation({
    summary: 'Change user role (admin)',
    description:
      'Role changes take effect in the JWT only after the user logs in again.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
  ): Promise<UserResponseDto> {
    return this.usersService.changeRole(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (admin)' })
  @ApiResponse({ status: 204 })
  deleteUser(@Param('id') id: string): Promise<void> {
    return this.usersService.deleteUser(id);
  }
}
