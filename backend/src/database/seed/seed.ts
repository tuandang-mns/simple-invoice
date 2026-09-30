/**
 * Seeds the database. Usage:
 *   npm run seed          # idempotent: upserts the demo user; inserts invoices only if none exist
 *   npm run seed:reset    # deletes all invoices and re-seeds
 *
 * Runs automatically on container start (see docker-entrypoint.sh).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { existsSync } from 'node:fs';
import { todayIn } from '../../common/utils/date.util';
import { SEED_USER_ID } from './seed-data';
import { insertSeedInvoices } from './seed-invoices';

// Local runs read backend/.env like the API does (ConfigModule); Prisma Client 6 no longer
// loads it. Shell variables win. In Docker there is no .env and compose provides the values.
if (existsSync('.env')) process.loadEnvFile('.env');

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to seed the demo user (see .env.example)`);
  }
  return value;
}

async function seedUser(): Promise<string> {
  const email = requireEnv('SEED_USER_EMAIL').trim().toLowerCase();
  const password = requireEnv('SEED_USER_PASSWORD');
  const fullname = process.env.SEED_USER_FULLNAME ?? 'Demo Admin';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullname },
    create: { id: SEED_USER_ID, email, passwordHash, fullname },
  });
  console.log(`✔ demo user ready: ${email}`);
  return user.id;
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const userId = await seedUser();

  if (reset) {
    const { count } = await prisma.invoice.deleteMany();
    console.log(`✔ reset: deleted ${count} invoices`);
  } else {
    const existing = await prisma.invoice.count();
    if (existing > 0) {
      console.log(
        `✔ ${existing} invoices already present — skipping (use "npm run seed:reset" to re-seed)`,
      );
      return;
    }
  }

  const today = todayIn(process.env.APP_TIMEZONE ?? 'Asia/Singapore');
  const count = await insertSeedInvoices(prisma, userId, today);
  console.log(
    `✔ seeded ${count} invoices (dates relative to ${today}; Appendix A figures verified)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('✖ seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
