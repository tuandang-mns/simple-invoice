import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import type { EnvironmentVariables } from '../config/env.validation';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.types';
import { LoginResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import {
  isTrustedOrigin,
  parseOrigins,
  SESSION_COOKIE,
  sessionCookieOptions,
} from './session-cookie';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly trustedOrigins: string[];
  private readonly secureCookie: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.trustedOrigins = parseOrigins(config.get('CORS_ORIGIN', { infer: true }));
    this.secureCookie = config.get('COOKIE_SECURE', { infer: true });
  }

  @Public()
  @UseGuards(ThrottlerGuard) // brute-force protection; limits from LOGIN_RATE_LIMIT/TTL
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with email + password',
    description:
      'Returns the JWT in the body (for API clients: send it as a Bearer token) and also sets it as an ' +
      'HttpOnly, Secure, SameSite=Strict cookie, which is what the web app uses; the web app never reads the token.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password', type: ErrorResponseDto })
  @ApiForbiddenResponse({
    description: 'Browser request from an unknown origin',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts', type: ErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponseDto> {
    // A browser always sends Origin here; only our own web app may start a cookie session
    // (stops login CSRF). API clients send no Origin and simply use the token from the body.
    const origin = request.headers.origin;
    if (origin !== undefined && !isTrustedOrigin(origin, this.trustedOrigins, request)) {
      throw new ForbiddenException('Request origin not allowed');
    }
    const result = await this.auth.login(dto.email, dto.password);
    void reply.setCookie(
      SESSION_COOKIE,
      result.accessToken,
      sessionCookieOptions(result.expiresIn, this.secureCookie),
    );
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({
    summary: 'Sign out: revoke the session on the server and clear the cookie',
    description: 'The token stops working immediately, including any copy of it.',
  })
  @ApiNoContentResponse({ description: 'Signed out' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token', type: ErrorResponseDto })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(user);
    void reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(0, this.secureCookie));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: 'Current authenticated user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token', type: ErrorResponseDto })
  me(@CurrentUser() user: JwtPayload): Promise<UserProfileDto> {
    return this.auth.me(user.sub);
  }
}
