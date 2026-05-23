import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface JwtPayloadUser {
  id: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayloadUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: JwtPayloadUser }>();
    return request.user;
  },
);
