import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';

  const adapter = new FastifyAdapter({
    // Fastify's built-in pino logger: one structured JSON line per request.
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    // Correlate logs across services: honour an incoming X-Request-Id or generate one.
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: new ConsoleLogger({ json: isProd, prefix: 'SimpleInvoice' }),
  });

  // Echo the request id back so clients/support can quote it.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (request, reply) => {
      void reply.header('x-request-id', request.id);
    });

  const config = app.get(ConfigService<EnvironmentVariables, true>);
  await configureApp(app, {
    corsOrigins: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((o) => o.trim()),
    swagger: config.get('SWAGGER_ENABLED', { infer: true }),
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(
    `API listening on :${port}${config.get('SWAGGER_ENABLED', { infer: true }) ? ' — Swagger at /api/docs' : ''}`,
  );
}

void bootstrap();
