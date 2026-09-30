import type { CookieSerializeOptions } from '@fastify/cookie';

/** Browser session cookie. HttpOnly: page scripts can never read the token (no XSS token theft). */
export const SESSION_COOKIE = 'si_session';

export function sessionCookieOptions(
  maxAgeSeconds: number,
  secure: boolean,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure,
    // Never sent on cross-site requests (first line of CSRF defence; see isTrustedOrigin).
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Parses CORS_ORIGIN ("a,b") into the list of web origins allowed to use the cookie. */
export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * CSRF defence for cookie-authenticated writes: the browser always sends `Origin` on a
 * cross-origin or non-GET request, so a write must come from one of our own web origins
 * (CORS_ORIGIN) or from the API's own origin (Swagger UI at /api/docs is same-origin).
 */
export function isTrustedOrigin(
  origin: string | undefined,
  allowed: string[],
  request: { protocol: string; headers: { host?: string } },
): boolean {
  if (origin === undefined) return false;
  return allowed.includes(origin) || origin === `${request.protocol}://${request.headers.host}`;
}
