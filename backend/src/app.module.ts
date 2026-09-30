import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { validateEnv, type EnvironmentVariables } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { InvoicesModule } from './invoices/invoices.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => [
        {
          ttl: config.get('LOGIN_RATE_TTL', { infer: true }) * 1000,
          limit: config.get('LOGIN_RATE_LIMIT', { infer: true }),
        },
      ],
    }),
    DatabaseModule,
    AuthModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
