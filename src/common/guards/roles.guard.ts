import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_PENDING_AUTHOR_KEY } from '../decorators/allow-pending-author.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ErrorCode } from '../errors/error-codes';
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import { assertApprovedAuthor } from './author-approval';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayloadUser }>();
    const user = request.user;

    if (!user || !required.includes(user.role as Role)) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN_ROLE);
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_AUTHOR_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowPending) {
      await assertApprovedAuthor(this.prisma, user);
    }

    return true;
  }
}
