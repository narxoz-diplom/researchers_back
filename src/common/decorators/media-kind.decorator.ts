import { SetMetadata } from '@nestjs/common';

export const MEDIA_KIND_KEY = 'mediaKind';

export type MediaKindValue = 'video' | 'material';

/** Tells LessonMediaGuard whether `:id` names a lesson video or a material. */
export const MediaKind = (kind: MediaKindValue) =>
  SetMetadata(MEDIA_KIND_KEY, kind);
