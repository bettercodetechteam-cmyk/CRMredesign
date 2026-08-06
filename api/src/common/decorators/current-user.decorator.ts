import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { AuthUser } from '../../modules/auth/auth-user.types';

type AuthenticatedRequest = Request & { user?: AuthUser };

/**
 * Injects the authenticated Postgres user set by FirebaseAuthGuard.
 * Example: `@CurrentUser() user: AuthUser`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    return request.user;
  },
);
