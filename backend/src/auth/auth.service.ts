import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { EnvironmentVariables } from '../config/env.validation';
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
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(email);
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordOk) {
      // Same message for both cases — never reveal which one was wrong.
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
      user: toProfile(user),
    };
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
