import { Prisma } from '@prisma/client';

/** True when the DB rejected a write because of a unique constraint/index (SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }
  // Expression indexes (e.g. lower(invoice_number)) can surface as a raw DB error.
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return error.message.includes('23505') || error.message.includes('unique constraint');
  }
  return false;
}
