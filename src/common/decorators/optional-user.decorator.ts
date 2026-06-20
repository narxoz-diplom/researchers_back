import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { JwtPayloadUser } from './current-user.decorator';

export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayloadUser | null => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayloadUser | null }>();
    return request.user ?? null;
  },
);
