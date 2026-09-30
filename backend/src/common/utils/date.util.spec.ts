import { addDays, todayIn, toDbDate, toIsoDate } from './date.util';

describe('date utils', () => {
  it('round-trips calendar dates without timezone drift', () => {
    expect(toIsoDate(toDbDate('2026-07-03'))).toBe('2026-07-03');
  });

  it('computes "today" in the business timezone, not the server timezone', () => {
    // 2026-09-29 20:00 UTC is already 2026-09-30 in Singapore (UTC+8).
    const instant = new Date('2026-09-29T20:00:00Z');
    expect(todayIn('UTC', instant)).toBe('2026-09-29');
    expect(todayIn('Asia/Singapore', instant)).toBe('2026-09-30');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
