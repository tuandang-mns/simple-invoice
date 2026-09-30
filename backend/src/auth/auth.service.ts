import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './auth.types';
import type { LoginResponseDto, UserProfileDto } from './dto/auth-response.dto';

/**
 * Compared against when the email doesn't exist so that "unknown user" and
 * "wrong password" take roughly the same time (reduces user enumeration).
 */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(email);
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordOk) {
      // Same message for both cases — never reveal which one was wrong.
      throw new UnauthorizedException('Invalid email or password');
    }

    // A server-side session backs every token, so it can be revoked before it expires.
    const expiresIn = this.config.get('JWT_EXPIRES_IN', { infer: true });
    const session = await this.prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + expiresIn * 1000) },
    });

    const payload: JwtPayload = { sub: user.id, email: user.email, sid: session.id };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn,
      user: toProfile(user),
    };
  }

  /** True when the token's session exists, belongs to its user, is not revoked and not expired. */
  async isSessionActive(payload: JwtPayload, now = new Date()): Promise<boolean> {
    if (!payload.sid) return false; // tokens from before sessions existed
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    return Boolean(
      session &&
      session.userId === payload.sub &&
      session.revokedAt === null &&
      session.expiresAt > now,
    );
  }

  /** Signs out: the session (and every copy of its token) stops working immediately. */
  async logout(payload: JwtPayload): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: payload.sid, userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<UserProfileDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      // Token is valid but the user was removed.
      throw new NotFoundException('User not found');
    }
    return toProfile(user);
  }
}

function toProfile(user: User): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    fullname: user.fullname,
    createdAt: user.createdAt.toISOString(),
  };
}
