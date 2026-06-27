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
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
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

  /**
   * Download lesson media for RAG indexing. Cloudinary CDN often blocks raw/PDF
   * delivery (401 ACL) even with signed URLs; Admin API download works reliably.
   */
  async downloadForIndexing(
    publicId: string,
    resourceType: UploadResourceType.VIDEO | UploadResourceType.RAW,
    storedUrl: string,
    mimeType?: string,
  ): Promise<Buffer> {
    const localBuffer = await this.readLocalUploadFile(storedUrl);
    if (localBuffer) {
      return localBuffer;
    }

    const publicIds = [publicId, this.extractPublicIdFromUrl(storedUrl)].filter(
      (id): id is string => Boolean(id?.trim()),
    );

    if (this.configured) {
      const fromAdmin = await this.downloadViaCloudinaryAdminApi(
        [...new Set(publicIds)],
        resourceType,
        storedUrl,
        mimeType,
      );
      if (fromAdmin) {
        return fromAdmin;
      }
    }

    const format = this.formatHintForDownload(
      publicId,
      resourceType,
      storedUrl,
      mimeType,
    );
    const candidates = this.indexingCdnDownloadUrls(
      [...new Set(publicIds)],
      resourceType,
      storedUrl,
      format,
    );
    let lastStatus = 0;

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(120_000),
        });
        if (response.ok) {
          return Buffer.from(await response.arrayBuffer());
        }
        lastStatus = response.status;
        this.logger.debug(
          `Indexing CDN download HTTP ${response.status} publicId=${publicId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Indexing CDN download failed publicId=${publicId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw new Error(`Failed to download media (${lastStatus || 404})`);
  }

  private async downloadViaCloudinaryAdminApi(
    publicIds: string[],
    resourceType: UploadResourceType.VIDEO | UploadResourceType.RAW,
    storedUrl: string,
    mimeType?: string,
  ): Promise<Buffer | null> {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    for (const publicId of publicIds) {
      let deliveryType: 'upload' | 'private' | 'authenticated' = 'upload';
      let resolvedPublicId = publicId;
      let format = '';

      try {
        const resource = (await cloudinary.api.resource(publicId, {
          resource_type: resourceType,
        })) as {
          public_id?: string;
          type?: string;
          format?: string;
        };
        resolvedPublicId = resource.public_id ?? publicId;
        if (resource.type === 'private' || resource.type === 'authenticated') {
          deliveryType = resource.type;
        }
        format = this.adminDownloadFormat(
          resolvedPublicId,
          resource.format,
          resourceType,
          storedUrl,
          mimeType,
        );
      } catch (error) {
        this.logger.debug(
          `Cloudinary resource lookup failed publicId=${publicId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        format = this.adminDownloadFormat(
          publicId,
          undefined,
          resourceType,
          storedUrl,
          mimeType,
        );
      }

      for (const type of [
        deliveryType,
        'upload',
        'authenticated',
        'private',
      ] as const) {
        const buffer = await this.fetchAdminDownloadUrl(
          resolvedPublicId,
          format,
          resourceType,
          type,
          expiresAt,
        );
        if (buffer) {
          return buffer;
        }
      }
    }

    return null;
  }

  private async fetchAdminDownloadUrl(
    publicId: string,
    format: string,
    resourceType: UploadResourceType.VIDEO | UploadResourceType.RAW,
    deliveryType: 'upload' | 'private' | 'authenticated',
    expiresAt: number,
  ): Promise<Buffer | null> {
    try {
      const url = cloudinary.utils.private_download_url(publicId, format, {
        resource_type: resourceType,
        type: deliveryType,
        expires_at: expiresAt,
      });
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        this.logger.debug(
          `Cloudinary admin download HTTP ${response.status} publicId=${publicId} type=${deliveryType}`,
        );
        return null;
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      this.logger.debug(
        `Cloudinary admin download failed publicId=${publicId} type=${deliveryType}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private adminDownloadFormat(
    publicId: string,
    resourceFormat: string | undefined,
    resourceType: UploadResourceType.VIDEO | UploadResourceType.RAW,
    storedUrl: string,
    mimeType?: string,
  ): string {
    if (extname(publicId)) {
      return '';
    }
    if (resourceFormat) {
      return resourceFormat;
    }
    return (
      this.formatHintForDownload(publicId, resourceType, storedUrl, mimeType) ??
      ''
    );
  }

  private async readLocalUploadFile(storedUrl: string): Promise<Buffer | null> {
    if (!storedUrl.trim()) {
      return null;
    }

    try {
      const pathname = new URL(storedUrl).pathname;
      const prefix = '/api/v1/media/files/';
      const markerIndex = pathname.indexOf(prefix);
      if (markerIndex === -1) {
        return null;
      }

      const relativePath = decodeURIComponent(
        pathname.slice(markerIndex + prefix.length),
      );
      if (!relativePath || relativePath.includes('..')) {
        return null;
      }

      return await readFile(join(UPLOAD_ROOT, relativePath));
    } catch (error) {
      this.logger.debug(
        `Local upload read failed url=${storedUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private indexingCdnDownloadUrls(
    publicIds: string[],
    resourceType: UploadResourceType.VIDEO | UploadResourceType.RAW,
    storedUrl: string,
    format: string | null,
  ): string[] {
    const urls: string[] = [];

    if (this.configured) {
      for (const publicId of publicIds) {
        const includeFormat = format && !extname(publicId);
        const urlOptions = {
          resource_type: resourceType,
          type: 'upload' as const,
          secure: true,
          sign_url: true,
          ...(includeFormat ? { format } : {}),
        };
        urls.push(cloudinary.url(publicId, urlOptions));

        for (const deliveryType of ['authenticated', 'private'] as const) {
          urls.push(
            cloudinary.url(publicId, {
              resource_type: resourceType,
              type: deliveryType,
              secure: true,
              sign_url: true,
              ...(includeFormat ? { format } : {}),
            }),
          );
        }
      }
    }

    if (storedUrl.trim()) {
      urls.push(storedUrl.trim());
    }

    return [...new Set(urls)];
  }

  private formatHintForDownload(
    publicId: string,
    resourceType: UploadResourceType.VIDEO | UploadResourceType.RAW,
    storedUrl: string,
    mimeType?: string,
  ): string | null {
    const fromId = extname(publicId).replace(/^\./, '');
    if (fromId) {
      return fromId;
    }

    const fromUrl = this.formatFromUrl(storedUrl);
    if (fromUrl) {
      return fromUrl;
    }

    const mimeToExt: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
    };
    if (mimeType && mimeToExt[mimeType]) {
      return mimeToExt[mimeType];
    }

    if (resourceType === UploadResourceType.VIDEO) {
      return 'mp4';
    }

    return null;
  }

  private formatFromUrl(url: string): string | null {
    try {
      const ext = extname(new URL(url).pathname).replace(/^\./, '');
      return ext || null;
    } catch {
      return null;
    }
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Cloudinary is not configured on the server',
      );
    }
  }
}
