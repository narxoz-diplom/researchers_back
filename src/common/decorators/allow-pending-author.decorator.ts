import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_AUTHOR_KEY = 'allowPendingAuthor';

/**
 * Lets an author whose offer is not approved yet reach an AUTHOR endpoint
 * (read-only studio data, profile settings). Everything else requires approval.
 */
export const AllowPendingAuthor = () =>
  SetMetadata(ALLOW_PENDING_AUTHOR_KEY, true);
