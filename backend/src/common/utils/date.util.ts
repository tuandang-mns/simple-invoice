/**
 * Calendar-date helpers. Invoice/due dates are calendar dates (Postgres DATE),
 * not instants, so we pass them around as "YYYY-MM-DD" strings and only convert
 * to a UTC-midnight Date at the persistence boundary. This avoids off-by-one
 * bugs caused by timezone conversion.
 */

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-07-03" -> Date at 2026-07-03T00:00:00.000Z (what Prisma expects for @db.Date). */
export function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Date from a @db.Date column -> "2026-07-03". */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in the given IANA timezone, e.g. "2026-09-29". */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD date. */
export function addDays(isoDate: string, days: number): string {
  const d = toDbDate(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}
