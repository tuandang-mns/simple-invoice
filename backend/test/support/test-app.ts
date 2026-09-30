/**
 * Shared e2e harness: a throwaway PostgreSQL (Testcontainers) with the real migrations,
 * and the real Nest app configured exactly like production (same pipes, filter, guard).
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { execSync } from 'node:child_process';
import request from 'supertest';

export const TEST_JWT_SECRET = 'e2e-test-secret-that-is-at-least-32-characters';
export const TEST_TIMEZONE = 'Asia/Singapore';

export interface TestContext {
  app: NestFastifyApplication;
  prisma: PrismaClient;
  http: () => ReturnType<typeof request>;
  createUser: (email: string, password: string) => Promise<string>;
  login: (email: string, password: string) => Promise<string>;
  close: () => Promise<void>;
}

export async function startTestApp(): Promise<TestContext> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();
  const databaseUrl = `${container.getConnectionUri()}?schema=public`;

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_EXPIRES_IN: '3600',
    APP_TIMEZONE: TEST_TIMEZONE,
    LOGIN_RATE_LIMIT: '1000',
  });

  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'ignore' });
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  // Import after env is set so ConfigModule validates the test configuration.
  const { AppModule } = await import('../../src/app.module');
  const { configureApp } = await import('../../src/app.setup');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configureApp(app, { corsOrigins: ['http://localhost'], swagger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const http = () => request(app.getHttpServer());

  return {
    app,
    prisma,
    http,
    createUser: async (email, password) =>
      (
        await prisma.user.create({
          data: { email, passwordHash: await bcrypt.hash(password, 4), fullname: 'E2E User' },
        })
      ).id,
    login: async (email, password) => {
      const res = await http().post('/auth/login').send({ email, password }).expect(200);
      return (res.body as { accessToken: string }).accessToken;
    },
    close: async () => {
      await app.close();
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
