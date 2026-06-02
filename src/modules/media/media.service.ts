import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join, relative } from 'path';
import type { Request } from 'express';
import { LocalUploadDto } from './dto/local-upload.dto';
import { LocalUploadResponseDto } from './dto/local-upload-response.dto';
import { SignResponseDto } from './dto/sign-response.dto';
import { SignUploadDto } from './dto/sign-upload.dto';
import { UploadResourceType } from './media.types';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

const MAX_BYTES: Record<UploadResourceType, number> = {
  [UploadResourceType.IMAGE]: 5 * 1024 * 1024,
  [UploadResourceType.VIDEO]: 500 * 1024 * 1024,
  [UploadResourceType.RAW]: 25 * 1024 * 1024,
};

const ALLOWED_MIME: Record<UploadResourceType, RegExp> = {
  [UploadResourceType.IMAGE]: /^image\/(jpeg|png|webp)$/,
  [UploadResourceType.VIDEO]: /^video\//,
  [UploadResourceType.RAW]: /.*/,
};

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private configured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.configured = true;
    } else {
      this.logger.warn(
        'Cloudinary is not configured; using local uploads in ./uploads (dev only)',
      );
    }
  }

  isCloudinaryConfigured(): boolean {
    return this.configured;
  }

  sign(input: SignUploadDto): SignResponseDto {
    this.ensureConfigured();

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder: input.folder,
    };
    if (input.publicId) {
      paramsToSign.public_id = input.publicId;
    }

    const apiSecret = this.configService.getOrThrow<string>(
      'CLOUDINARY_API_SECRET',
    );
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret,
    );

    return {
      cloudName: this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      apiKey: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      timestamp,
      signature,
      folder: input.folder,
      resourceType: input.resourceType,
      ...(input.publicId ? { publicId: input.publicId } : {}),
    };
  }

  signAvatar(userId: string): SignResponseDto {
    return this.sign({
      resourceType: UploadResourceType.IMAGE,
      folder: `avatars/${userId}`,
    });
  }

  async uploadLocal(
    file: Express.Multer.File | undefined,
    dto: LocalUploadDto,
    req: Request,
  ): Promise<LocalUploadResponseDto> {
    if (this.configured) {
      throw new BadRequestException(
        'Cloudinary is configured; use POST /media/sign for uploads',
      );
    }
    if (!file || (!file.path && !file.buffer?.length)) {
      throw new BadRequestException('file is required');
    }

    const maxBytes = MAX_BYTES[dto.resourceType];
    if (file.size > maxBytes) {
      await this.removeUploadedFile(file);
      throw new BadRequestException(
        `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`,
      );
    }
    if (!ALLOWED_MIME[dto.resourceType].test(file.mimetype)) {
      await this.removeUploadedFile(file);
      throw new BadRequestException('Unsupported file type');
    }

    let relativePath: string;
    if (file.path) {
      relativePath = relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/');
    } else {
      const ext = this.defaultExtension(dto.resourceType, file.originalname);
      const filename = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
      relativePath = `${dto.folder}/${filename}`;
      const fullPath = join(UPLOAD_ROOT, relativePath);
      await mkdir(join(UPLOAD_ROOT, dto.folder), { recursive: true });
      await writeFile(fullPath, file.buffer);
    }

    const ext = extname(relativePath);

    const baseUrl = this.publicBaseUrl(req);
    const secure_url = `${baseUrl}/api/v1/media/files/${relativePath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;

    return {
      public_id: relativePath.replace(/\.[^.]+$/, ''),
      secure_url,
      bytes: file.size,
      format: ext.replace('.', '') || undefined,
      resource_type: dto.resourceType,
    };
  }

  private defaultExtension(
    resourceType: UploadResourceType,
    originalName: string,
  ): string {
    const fromName = extname(originalName);
    if (fromName) {
      return fromName;
    }
    if (resourceType === UploadResourceType.IMAGE) {
      return '.jpg';
    }
    if (resourceType === UploadResourceType.VIDEO) {
      return '.mp4';
    }
    return '';
  }

  private async removeUploadedFile(file: Express.Multer.File): Promise<void> {
    if (file.path) {
      await unlink(file.path).catch(() => undefined);
    }
  }

  private publicBaseUrl(req: Request): string {
    const fromEnv = this.configService.get<string>('PUBLIC_API_URL')?.trim();
    if (fromEnv) {
      return fromEnv.replace(/\/$/, '');
    }
    const host =
      req.get('host') ?? `localhost:${this.configService.get('PORT') ?? 8080}`;
    const protocol = req.protocol === 'https' ? 'https' : 'http';
    return `${protocol}://${host}`;
  }

  extractPublicIdFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const uploadIndex = pathname.indexOf('/upload/');
      if (uploadIndex === -1) {
        return null;
      }
      const afterUpload = pathname.slice(uploadIndex + '/upload/'.length);
      const segments = afterUpload.split('/').filter(Boolean);
      if (!segments.length) {
        return null;
      }
      if (/^v\d+$/.test(segments[0])) {
        segments.shift();
      }
      const last = segments.pop();
      if (!last) {
        return null;
      }
      const withoutExt = last.replace(/\.[^.]+$/, '');
      return [...segments, withoutExt].join('/');
    } catch {
      return null;
    }
  }

  async deleteAvatarByUrl(avatarUrl: string): Promise<void> {
    const publicId = this.extractPublicIdFromUrl(avatarUrl);
    if (publicId) {
      await this.deleteByPublicIds([publicId], UploadResourceType.IMAGE);
    }
  }

  async deleteByPublicIds(
    publicIds: string[],
    resourceType: UploadResourceType,
  ): Promise<void> {
    if (!publicIds.length || !this.configured) {
      return;
    }

    await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    });
  }

  async deleteCourseAssets(publicIds: {
    videoIds: string[];
    rawIds: string[];
    imageIds: string[];
  }): Promise<void> {
    await Promise.all([
      this.deleteByPublicIds(publicIds.videoIds, UploadResourceType.VIDEO),
      this.deleteByPublicIds(publicIds.rawIds, UploadResourceType.RAW),
      this.deleteByPublicIds(publicIds.imageIds, UploadResourceType.IMAGE),
    ]);
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Cloudinary is not configured on the server',
      );
    }
  }
}
