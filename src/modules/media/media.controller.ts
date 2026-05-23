import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
import { SignResponseDto } from './dto/sign-response.dto';
import { SignUploadDto } from './dto/sign-upload.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Roles(Role.AUTHOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('sign')
  @ApiOperation({
    summary: 'Get signed Cloudinary upload parameters',
    description:
      'Returns cloudName, apiKey, timestamp, and signature for direct frontend upload. API secret is never exposed.',
  })
  @ApiResponse({ status: 200, type: SignResponseDto })
  @ApiResponse({ status: 503, description: 'Cloudinary not configured' })
  sign(@Body() dto: SignUploadDto): SignResponseDto {
    return this.mediaService.sign(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('sign/avatar')
  @ApiOperation({
    summary: 'Get signed upload parameters for user avatar',
    description: 'Uses folder avatars/{userId} and resource type image.',
  })
  @ApiResponse({ status: 200, type: SignResponseDto })
  signAvatar(@CurrentUser() user: JwtPayloadUser): SignResponseDto {
    return this.mediaService.signAvatar(user.id);
  }
}
