import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Every environment variable the API reads, with defaults for the non-secret ones.
 * The app refuses to start if a required value is missing or invalid (fail fast),
 * so a half-configured container never reaches "healthy".
 */
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  /** No default on purpose — secrets must come from the environment. */
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  /** Access-token lifetime in seconds (spec §2.3.3: default 3600). */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN = 3600;

  @IsString()
  CORS_ORIGIN = 'http://localhost:5173';

  @IsString()
  APP_TIMEZONE = 'Asia/Singapore';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LOGIN_RATE_LIMIT = 10;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LOGIN_RATE_TTL = 60;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL = 'info';

  /** Serve Swagger UI at /api/docs. On for the assessment; disable (or protect) in production. */
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  SWAGGER_ENABLED = true;

  /**
   * Mark the session cookie `Secure` (sent over HTTPS only). Browsers treat http://localhost as
   * secure, so this stays on even for the local demo; set false only for a non-localhost HTTP host.
   */
  @Transform(
    ({ value }: { value: unknown }) => value === undefined || value === true || value === 'true',
  )
  @IsBoolean()
  COOKIE_SECURE = true;

  @IsOptional()
  @IsString()
  SEED_USER_EMAIL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if (!isValidTimeZone(validated.APP_TIMEZONE)) {
    throw new Error(`Invalid environment configuration: APP_TIMEZONE "${validated.APP_TIMEZONE}"`);
  }
  return validated;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
