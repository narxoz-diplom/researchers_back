import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { LocalUploadDto } from './dto/local-upload.dto';
import { LocalUploadResponseDto } from './dto/local-upload-response.dto';
import { SignResponseDto } from './dto/sign-response.dto';
import { SignUploadDto } from './dto/sign-upload.dto';
import { MediaService } from './media.service';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

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

  @Roles(Role.AUTHOR, Role.ADMIN, Role.SUBSCRIBER)
  @HttpCode(HttpStatus.OK)
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload file to local disk (dev fallback when Cloudinary is off)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'resourceType', 'folder'],
      properties: {
        file: { type: 'string', format: 'binary' },
        resourceType: { type: 'string', enum: ['image', 'video', 'raw'] },
        folder: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, type: LocalUploadResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const folder = String((req.body as { folder?: string })?.folder ?? '');
          if (!/^(courses|avatars)\/[a-zA-Z0-9/_-]+$/.test(folder)) {
            cb(new Error('Invalid upload folder'), '');
            return;
          }
          const dest = join(UPLOAD_ROOT, folder);
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '';
          cb(
            null,
            `${Date.now()}-${Math.random().toString(16).slice(2, 10)}${ext}`,
          );
        },
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  uploadLocal(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: LocalUploadDto,
    @Req() req: Request,
  ): Promise<LocalUploadResponseDto> {
    return this.mediaService.uploadLocal(file, dto, req);
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
