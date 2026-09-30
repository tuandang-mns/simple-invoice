/** Authentication & token handling against the real app. */
import { JwtService } from '@nestjs/jwt';
import { startTestApp, TEST_JWT_SECRET, type TestContext } from './support/test-app';

jest.setTimeout(180_000);

const EMAIL = 'auth@simpleinvoice.dev';
const PASSWORD = 'AuthPassword!1';

describe('Auth (e2e)', () => {
  let ctx: TestContext;
  let userId: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    userId = await ctx.createUser(EMAIL, PASSWORD);
  });

  afterAll(() => ctx?.close());

  const me = (authorization?: string) => {
    const req = ctx.http().get('/auth/me');
    return authorization ? req.set({ Authorization: authorization }) : req;
  };

  describe('POST /auth/login', () => {
    it('issues a bearer token and profile, never the password hash', async () => {
      const res = await ctx
        .http()
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD })
        .expect(200);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { id: userId, email: EMAIL, fullname: 'E2E User' },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('treats the email case-insensitively', async () => {
      await ctx
        .http()
        .post('/auth/login')
        .send({ email: '  AUTH@SimpleInvoice.dev ', password: PASSWORD })
        .expect(200);
    });

    it('answers a wrong password and an unknown email identically (no enumeration)', async () => {
      const wrong = await ctx
        .http()
        .post('/auth/login')
        .send({ email: EMAIL, password: 'nope' })
        .expect(401);
      const unknown = await ctx
        .http()
        .post('/auth/login')
        .send({ email: 'ghost@simpleinvoice.dev', password: 'nope' })
        .expect(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
    });

    it('validates input and rejects unknown properties', async () => {
      const res = await ctx
        .http()
        .post('/auth/login')
        .send({ email: 'not-an-email', password: '', role: 'admin' })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'property role should not exist',
          'email must be a valid email address',
          'password is required',
        ]),
      );
    });
  });

  describe('protected routes', () => {
    it('returns the profile for a valid token', async () => {
      const token = await ctx.login(EMAIL, PASSWORD);
      const res = await me(`Bearer ${token}`).expect(200);
      expect(res.body).toMatchObject({ id: userId, email: EMAIL });
    });

    it('rejects a missing token', async () => {
      expect((await me().expect(401)).body.message).toBe('Missing access token');
    });

    it('rejects a non-Bearer scheme', async () => {
      await me('Token abc').expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const forged = new JwtService({ secret: 'attacker-secret-attacker-secret-attacker' }).sign({
        sub: userId,
        email: EMAIL,
      });
      expect((await me(`Bearer ${forged}`).expect(401)).body.message).toBe(
        'Invalid or expired access token',
      );
    });

    it('rejects an expired token', async () => {
      const expired = new JwtService({ secret: TEST_JWT_SECRET }).sign({
        sub: userId,
        email: EMAIL,
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      await me(`Bearer ${expired}`).expect(401);
    });

    it('rejects an unsigned "alg: none" token', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: userId, email: EMAIL })}.`;
      await me(`Bearer ${unsigned}`).expect(401);
    });
  });

  describe('Browser session (HttpOnly cookie) and sign-out', () => {
    // The guard trusts CORS_ORIGIN; the test app uses the default.
    const WEB_ORIGIN = 'http://localhost:5173';

    const loginRes = () =>
      ctx
        .http()
        .post('/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: EMAIL, password: PASSWORD })
        .expect(200);
    const sessionCookie = (res: { headers: Record<string, unknown> }) =>
      ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) =>
        c.startsWith('si_session='),
      );
    const cookiePair = (setCookie: string) => setCookie.split(';')[0];

    it('sets the token as an HttpOnly, Secure, SameSite=Strict cookie', async () => {
      const cookie = sessionCookie(await loginRes());
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Max-Age=3600/);
    });

    it('authenticates with the cookie alone (no Authorization header)', async () => {
      const cookie = cookiePair(sessionCookie(await loginRes())!);
      const res = await ctx.http().get('/auth/me').set('Cookie', cookie).expect(200);
      expect(res.body).toMatchObject({ id: userId, email: EMAIL });
    });

    it('blocks cookie-authenticated writes from a missing or foreign Origin (CSRF)', async () => {
      const cookie = cookiePair(sessionCookie(await loginRes())!);
      for (const origin of [undefined, 'https://evil.example']) {
        const req = ctx.http().post('/invoices').set('Cookie', cookie).send({});
        const res = await (origin ? req.set('Origin', origin) : req).expect(403);
        expect(res.body).toEqual({
          statusCode: 403,
          message: 'Request origin not allowed',
          error: 'Forbidden',
        });
      }
      // From the web app's own origin the request passes the guard and reaches validation.
      await ctx
        .http()
        .post('/invoices')
        .set('Cookie', cookie)
        .set('Origin', WEB_ORIGIN)
        .send({})
        .expect(400);
    });

    it("treats the API's own origin (Swagger UI) as trusted", async () => {
      const cookie = cookiePair(sessionCookie(await loginRes())!);
      await ctx
        .http()
        .post('/invoices')
        .set('Cookie', cookie)
        .set('Host', 'api.example')
        .set('Origin', 'http://api.example') // same origin as the request itself
        .send({})
        .expect(400); // passed the guard, reached validation
    });

    it('refuses to start a session for a foreign Origin (login CSRF)', async () => {
      const res = await ctx
        .http()
        .post('/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: EMAIL, password: PASSWORD })
        .expect(403);
      expect(sessionCookie(res)).toBeUndefined();
    });

    it('sign-out revokes the session on the server: every copy of the token stops working', async () => {
      const res = await loginRes();
      const token = (res.body as { accessToken: string }).accessToken;
      const cookie = cookiePair(sessionCookie(res)!);
      await me(`Bearer ${token}`).expect(200);

      const out = await ctx
        .http()
        .post('/auth/logout')
        .set('Cookie', cookie)
        .set('Origin', WEB_ORIGIN)
        .expect(204);
      expect(sessionCookie(out)).toMatch(/si_session=;/); // cleared in the browser

      await me(`Bearer ${token}`).expect(401); // a copied token is dead too
      await ctx.http().get('/auth/me').set('Cookie', cookie).expect(401);
      const other = await ctx.prisma.session.count({ where: { userId, revokedAt: null } });
      expect(other).toBeGreaterThan(0); // other sessions (other devices) are untouched
    });

    it('allows credentialed CORS only for the configured origin', async () => {
      const res = await ctx
        .http()
        .options('/auth/me')
        .set('Origin', 'http://localhost')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  it('serves /health without authentication', async () => {
    expect((await ctx.http().get('/health').expect(200)).body).toEqual({ status: 'ok' });
  });
});
