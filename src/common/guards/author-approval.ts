import { ForbiddenException } from '@nestjs/common';
import { AuthorStatus, Role } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayloadUser } from '../decorators/current-user.decorator';
import { ErrorCode } from '../errors/error-codes';

/**
 * Authors manage courses only after an admin approved their offer. The status
 * is read from the database, so approval or revocation applies immediately
 * without waiting for the access token to expire.
 */
export async function assertApprovedAuthor(
  prisma: PrismaService,
  user: JwtPayloadUser,
): Promise<void> {
  if (user.role !== Role.AUTHOR) {
    return;
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, authorStatus: true },
  });

  if (row?.role !== Role.AUTHOR || row.authorStatus !== AuthorStatus.APPROVED) {
    throw new ForbiddenException(ErrorCode.AUTHOR_NOT_APPROVED);
  }
}
