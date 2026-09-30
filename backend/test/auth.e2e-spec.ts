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

  it('serves /health without authentication', async () => {
    expect((await ctx.http().get('/health').expect(200)).body).toEqual({ status: 'ok' });
  });
});
