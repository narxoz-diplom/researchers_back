import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

/** Allows requests without JWT; attaches user when a valid token is present. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const result = super.canActivate(context);
    if (result instanceof Observable) {
      return result.pipe(catchError(() => of(true)));
    }
    if (result instanceof Promise) {
      return result.catch(() => true);
    }
    return result;
  }

  handleRequest<TUser>(_err: unknown, user: TUser | false): TUser | null {
    if (_err || !user) return null;
    return user;
  }
}
