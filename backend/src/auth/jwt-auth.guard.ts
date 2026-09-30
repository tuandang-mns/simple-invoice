import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import type { EnvironmentVariables } from '../config/env.validation';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest, JwtPayload } from './auth.types';
import { isTrustedOrigin, parseOrigins, SESSION_COOKIE } from './session-cookie';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard (registered as APP_GUARD): every route requires a valid session unless it is
 * marked @Public(). The token comes from the HttpOnly session cookie (the web app) or from
 * `Authorization: Bearer <jwt>` (API clients such as Swagger or Postman). Either way the JWT
 * must verify AND its server-side session must still be active, so sign-out revokes it at once.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly trustedOrigins: string[];

  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.trustedOrigins = parseOrigins(config.get('CORS_ORIGIN', { infer: true }));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = extractBearerToken(request.headers.authorization);
    const cookie = request.cookies?.[SESSION_COOKIE];
    const token = bearer ?? cookie;
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    // A browser attaches cookies automatically, so a cookie-authenticated write must come from
    // our own web app (CSRF). Bearer tokens are never sent automatically, so they don't need it.
    if (
      !bearer &&
      !SAFE_METHODS.has(request.method) &&
      !isTrustedOrigin(request.headers.origin, this.trustedOrigins, request)
    ) {
      throw new ForbiddenException('Request origin not allowed');
    }

    let payload: JwtPayload;
    try {
      // Verifies signature, algorithm and expiry (exp claim).
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (!(await this.auth.isSessionActive(payload))) {
      throw new UnauthorizedException('Session has ended; please sign in again');
    }
    request.user = payload;
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
