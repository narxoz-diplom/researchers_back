import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { ApiCommonErrors } from '../../common/decorators/api-error-responses.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  @ApiOperation({ summary: 'Register a new subscriber account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiCommonErrors(409)
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiCommonErrors(401)
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate access and refresh tokens' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token(s) for current user' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: LogoutDto,
  ): Promise<void> {
    await this.authService.logout(user, dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: AuthUserDto })
  me(@CurrentUser() user: JwtPayloadUser): Promise<AuthUserDto> {
    return this.authService.getMe(user.id);
  }
}
