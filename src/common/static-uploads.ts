import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const UPLOADS_URL_PREFIX = '/api/v1/media/files/';

/**
 * Local uploads (dev fallback for Cloudinary). Covers, avatars and founder
 * media are public. Lesson files live under courses/<id>/lessons/ and are paid
 * content: they are reachable only through the guarded /videos/:id/stream and
 * /materials/:id/view routes, never by a direct link.
 */
export function setupUploadsStatic(app: NestExpressApplication): void {
  if (!existsSync(UPLOADS_DIR)) {
    try {
      mkdirSync(UPLOADS_DIR, { recursive: true });
    } catch (err) {
      Logger.warn(
        `Could not create uploads directory at ${UPLOADS_DIR}: ${err instanceof Error ? err.message : String(err)}`,
        'Bootstrap',
      );
    }
  }
  if (!existsSync(UPLOADS_DIR)) {
    return;
  }

  app.use(
    `${UPLOADS_URL_PREFIX}courses/:courseId/lessons`,
    (_req: Request, res: Response) => {
      res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: 'Lesson media is available only from the lesson page',
      });
    },
  );
  app.useStaticAssets(UPLOADS_DIR, { prefix: UPLOADS_URL_PREFIX });
}
