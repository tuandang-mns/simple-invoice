import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Cross-cutting app configuration, shared by main.ts and the e2e tests so that
 * tests exercise exactly the same pipes/filters/validation as production.
 */
export async function configureApp(
  app: NestFastifyApplication,
  options: { corsOrigins: string[]; swagger?: boolean },
): Promise<void> {
  // The API only returns JSON; CSP is enforced on the frontend (nginx). Disabled here so Swagger UI loads.
  await app.register(helmet, { contentSecurityPolicy: false });
  // Parses the HttpOnly session cookie (see auth/session-cookie.ts).
  await app.register(cookie);

  app.enableCors({
    origin: options.corsOrigins, // an explicit list, never "*": required when credentials are allowed
    credentials: true, // the web app sends the session cookie cross-origin (localhost:8080 → :3000)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties…
      forbidNonWhitelisted: true, // …and reject them (e.g. a client trying to set "status")
      transform: true, // apply DTO defaults/types
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (options.swagger !== false) {
    const config = new DocumentBuilder()
      .setTitle('SimpleInvoice API')
      .setDescription(
        'REST API for SimpleInvoice. Log in via POST /auth/login, then click "Authorize" and paste the accessToken. ' +
          'The web app uses the HttpOnly session cookie set by the same call instead.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }
}
