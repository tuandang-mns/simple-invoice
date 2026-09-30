import type { FastifyRequest } from 'fastify';

/** Claims carried in our access token. `sub` is the user id (RFC 7519). */
export interface JwtPayload {
  sub: string;
  email: string;
  /** Session id (row in `sessions`); lets the server revoke this token before it expires. */
  sid: string;
}

export type AuthenticatedRequest = FastifyRequest & { user: JwtPayload };
