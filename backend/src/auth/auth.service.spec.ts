import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
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
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns a bearer token and profile for valid credentials', async () => {
    users.findByEmail.mockResolvedValue(user);
    const result = await service.login(user.email, 'Password123!');

    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: user.id, email: user.email });
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
  });

  it('rejects an unknown email with the SAME generic message (no user enumeration)', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(service.login('ghost@x.io', 'Password123!')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });
});
