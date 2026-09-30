import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, JwtPayload } from '../../auth/auth.types';

/** Injects the authenticated user's JWT claims into a controller handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
