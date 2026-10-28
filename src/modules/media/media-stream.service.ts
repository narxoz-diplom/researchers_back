import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname, join, normalize, sep } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { MediaService } from './media.service';
import { UploadResourceType } from './media.types';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const LOCAL_URL_PREFIX = '/api/v1/media/files/';
const UPSTREAM_TIMEOUT_MS = 120_000;

export interface StreamSource {
  storedUrl: string;
  publicId: string | null;
  resourceType: UploadResourceType.VIDEO | UploadResourceType.RAW;
  mimeType: string;
  filename: string;
}

/**
 * Serves lesson files to viewers through the API so the origin URL (local
 * upload or Cloudinary) never reaches the browser. Supports HTTP ranges, which
 * the `<video>` element needs for seeking.
 */
@Injectable()
export class MediaStreamService {
  private readonly logger = new Logger(MediaStreamService.name);

  constructor(private readonly mediaService: MediaService) {}

  async stream(
    req: Request,
    res: Response,
    source: StreamSource,
  ): Promise<void> {
    const localPath = this.localPathFor(source.storedUrl);
    if (localPath) {
      await this.sendLocal(req, res, localPath, source);
      return;
    }
    await this.proxyRemote(req, res, source);
  }

  private setViewerHeaders(res: Response, source: StreamSource): void {
    res.setHeader('Content-Disposition', inlineDisposition(source.filename));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  private localPathFor(storedUrl: string): string | null {
    try {
      const pathname = new URL(storedUrl).pathname;
      const index = pathname.indexOf(LOCAL_URL_PREFIX);
      if (index === -1) {
        return null;
      }
      const relativePath = decodeURIComponent(
        pathname.slice(index + LOCAL_URL_PREFIX.length),
      );
      const absolute = normalize(join(UPLOAD_ROOT, relativePath));
      if (!absolute.startsWith(UPLOAD_ROOT + sep)) {
        return null;
      }
      return absolute;
    } catch {
      return null;
    }
  }

  private async sendLocal(
    req: Request,
    res: Response,
    absolutePath: string,
    source: StreamSource,
  ): Promise<void> {
    let size: number;
    try {
      const info = await stat(absolutePath);
      if (!info.isFile()) {
        throw new Error('not a file');
      }
      size = info.size;
    } catch {
      throw new NotFoundException('File not found');
    }

    this.setViewerHeaders(res, source);
    res.setHeader('Content-Type', source.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${size}`);
      res.end();
      return;
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : size - 1;
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    } else {
      res.status(200);
    }
    res.setHeader('Content-Length', String(size === 0 ? 0 : end - start + 1));

    if (req.method === 'HEAD' || size === 0) {
      res.end();
      return;
    }

    try {
      await pipeline(createReadStream(absolutePath, { start, end }), res);
    } catch (error) {
      // The viewer closed the player mid-stream; nothing to report.
      this.logger.debug(
        `Local stream ended early: ${error instanceof Error ? error.message : String(error)}`,
      );
      res.destroy();
    }
  }

  private async proxyRemote(
    req: Request,
    res: Response,
    source: StreamSource,
  ): Promise<void> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    res.once('close', abort);
    const timer = setTimeout(abort, UPSTREAM_TIMEOUT_MS);

    let lastStatus = 0;
    try {
      for (const url of this.remoteCandidates(source)) {
        let upstream: globalThis.Response;
        try {
          upstream = await fetch(url, {
            headers: req.headers.range ? { Range: req.headers.range } : {},
            signal: controller.signal,
            redirect: 'follow',
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          this.logger.debug(
            `Upstream fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }

        if (upstream.status !== 200 && upstream.status !== 206) {
          lastStatus = upstream.status;
          await upstream.body?.cancel().catch(() => undefined);
          continue;
        }

        res.status(upstream.status);
        for (const name of [
          'content-type',
          'content-length',
          'content-range',
          'accept-ranges',
        ]) {
          const value = upstream.headers.get(name);
          if (value) {
            res.setHeader(name, value);
          }
        }
        if (!upstream.headers.get('content-type')) {
          res.setHeader('Content-Type', source.mimeType);
        }
        this.setViewerHeaders(res, source);

        if (!upstream.body || req.method === 'HEAD') {
          await upstream.body?.cancel().catch(() => undefined);
          res.end();
          return;
        }

        try {
          await pipeline(
            Readable.fromWeb(upstream.body as unknown as WebReadableStream),
            res,
          );
        } catch (error) {
          this.logger.debug(
            `Proxied stream ended early: ${error instanceof Error ? error.message : String(error)}`,
          );
          res.destroy();
        }
        return;
      }
    } finally {
      clearTimeout(timer);
      res.off('close', abort);
    }

    // Cloudinary refuses direct delivery of PDF/raw files on many accounts (401),
    // even with signed URLs; the Admin API download still works, so serve the
    // material from a buffer. Videos are left to the CDN: they stream fine and
    // would not fit in memory anyway.
    if (
      source.resourceType === UploadResourceType.RAW &&
      source.publicId &&
      this.mediaService.isCloudinaryConfigured() &&
      !res.headersSent
    ) {
      const buffer = await this.mediaService
        .downloadForIndexing(
          source.publicId,
          source.resourceType,
          source.storedUrl,
          source.mimeType,
        )
        .catch((error: unknown) => {
          this.logger.warn(
            `Admin API download failed publicId=${source.publicId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        });
      if (buffer) {
        this.sendBuffer(req, res, buffer, source);
        return;
      }
    }

    throw new NotFoundException({
      statusCode: 404,
      message: 'MEDIA_UNAVAILABLE',
      detail: `upstream ${lastStatus || 'unreachable'}`,
    });
  }

  /** Whole file already in memory: answer the request (with ranges) from it. */
  private sendBuffer(
    req: Request,
    res: Response,
    buffer: Buffer,
    source: StreamSource,
  ): void {
    const size = buffer.length;
    this.setViewerHeaders(res, source);
    res.setHeader('Content-Type', source.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${size}`);
      res.end();
      return;
    }
    const start = range ? range.start : 0;
    const end = range ? range.end : size - 1;
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    } else {
      res.status(200);
    }
    res.setHeader('Content-Length', String(size === 0 ? 0 : end - start + 1));
    if (req.method === 'HEAD' || size === 0) {
      res.end();
      return;
    }
    res.end(buffer.subarray(start, end + 1));
  }

  /** The stored URL first (what played before), then signed Cloudinary deliveries. */
  private remoteCandidates(source: StreamSource): string[] {
    const urls: string[] = [];
    if (source.storedUrl.trim()) {
      urls.push(source.storedUrl.trim());
    }
    if (this.mediaService.isCloudinaryConfigured() && source.publicId) {
      const format = extname(source.storedUrl).replace(/^\./, '');
      const includeFormat = format && !extname(source.publicId);
      for (const type of ['upload', 'authenticated', 'private'] as const) {
        urls.push(
          cloudinary.url(source.publicId, {
            resource_type: source.resourceType,
            type,
            secure: true,
            sign_url: true,
            ...(includeFormat ? { format } : {}),
          }),
        );
      }
    }
    return [...new Set(urls)];
  }
}

function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null | 'invalid' {
  if (!header) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size === 0) {
    return match ? 'invalid' : null;
  }
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') {
    return 'invalid';
  }
  // "bytes=-500" means the last 500 bytes.
  const start =
    rawStart === '' ? Math.max(0, size - Number(rawEnd)) : Number(rawStart);
  const end =
    rawStart === '' || rawEnd === ''
      ? size - 1
      : Math.min(Number(rawEnd), size - 1);
  if (start > end || start >= size) {
    return 'invalid';
  }
  return { start, end };
}

function inlineDisposition(filename: string): string {
  const asciiFallback =
    filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'file';
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
