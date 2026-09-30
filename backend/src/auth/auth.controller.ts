import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.types';
import { LoginResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard) // brute-force protection; limits from LOGIN_RATE_LIMIT/TTL
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email + password and receive a JWT' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password', type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts', type: ErrorResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token', type: ErrorResponseDto })
  me(@CurrentUser() user: JwtPayload): Promise<UserProfileDto> {
    return this.auth.me(user.sub);
  }
}
