import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { SignResponseDto } from './dto/sign-response.dto';
import { SignUploadDto } from './dto/sign-upload.dto';
import { UploadResourceType } from './media.types';

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
        'Cloudinary is not configured; signed uploads and CDN deletes are disabled',
      );
    }
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
