import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { PrismaService } from '../database/prisma.service';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    email: 'admin@simpleinvoice.dev',
    fullname: 'Demo Admin',
    passwordHash: bcrypt.hashSync('Password123!', 4),
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const users = { findByEmail: jest.fn(), findById: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const config = { get: jest.fn().mockReturnValue(3600) };
  const SESSION_ID = '5e551011-0000-4000-8000-000000000001';
  const prisma = {
    session: {
      create: jest.fn().mockResolvedValue({ id: SESSION_ID }),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService as never,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a server-side session and returns a token bound to it', async () => {
    users.findByEmail.mockResolvedValue(user);
    const before = Date.now();
    const result = await service.login(user.email, 'Password123!');

    const { data } = prisma.session.create.mock.calls[0][0] as {
      data: { userId: string; expiresAt: Date };
    };
    expect(data.userId).toBe(user.id);
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      sid: SESSION_ID,
    });
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a wrong password with a generic message', async () => {
    users.findByEmail.mockResolvedValue(user);
    await expect(service.login(user.email, 'wrong')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with the SAME generic message (no user enumeration)', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(service.login('ghost@x.io', 'Password123!')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  describe('sessions', () => {
    const payload = { sub: user.id, email: user.email, sid: SESSION_ID };
    const now = new Date('2026-09-30T10:00:00Z');
    const row = (over: object = {}) => ({
      id: SESSION_ID,
      userId: user.id,
      revokedAt: null,
      expiresAt: new Date('2026-09-30T11:00:00Z'),
      ...over,
    });

    it('accepts an active session', async () => {
      prisma.session.findUnique.mockResolvedValue(row());
      await expect(service.isSessionActive(payload, now)).resolves.toBe(true);
    });

    it.each([
      ['revoked (signed out)', { revokedAt: new Date('2026-09-30T09:59:00Z') }],
      ['expired', { expiresAt: new Date('2026-09-30T09:00:00Z') }],
      ['owned by another user', { userId: 'someone-else' }],
    ])('rejects a session that is %s', async (_label, over) => {
      prisma.session.findUnique.mockResolvedValue(row(over));
      await expect(service.isSessionActive(payload, now)).resolves.toBe(false);
    });

    it('rejects an unknown session and a token without a session id', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      await expect(service.isSessionActive(payload, now)).resolves.toBe(false);
      await expect(
        service.isSessionActive({ sub: user.id, email: user.email } as never, now),
      ).resolves.toBe(false);
    });

    it("logout revokes only this user's active session", async () => {
      await service.logout(payload);
      const { where, data } = prisma.session.updateMany.mock.calls[0][0] as {
        where: object;
        data: { revokedAt: Date };
      };
      expect(where).toEqual({ id: SESSION_ID, userId: user.id, revokedAt: null });
      expect(data.revokedAt).toBeInstanceOf(Date);
    });
  });
});
