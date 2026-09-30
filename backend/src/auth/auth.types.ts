import type { FastifyRequest } from 'fastify';

/** Claims carried in our access token. `sub` is the user id (RFC 7519). */
export interface JwtPayload {
  sub: string;
  email: string;
}

export type AuthenticatedRequest = FastifyRequest & { user: JwtPayload };
