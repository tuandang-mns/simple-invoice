import { describe, expect, it } from 'vitest';
import { addDaysIso, formatDate, formatDateTime, formatMoney } from './format';

describe('format helpers', () => {
  it('formats calendar dates without timezone shifts', () => {
    expect(formatDate('2026-07-03')).toBe('03 Jul 2026');
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026');
  });

  it('formats money with symbol, thousands separators and 2 decimals', () => {
    expect(formatMoney(2180, 'AU$')).toBe('AU$2,180.00');
    expect(formatMoney(728.66, 'S$')).toBe('S$728.66');
    expect(formatMoney(-5, '£')).toBe('-£5.00');
  });

  it('formats zero-decimal currencies (VND) without decimals', () => {
    expect(formatMoney(1650000, '₫', 0)).toBe('₫1,650,000');
    expect(formatMoney(109999, '₫', 0)).toBe('₫109,999');
  });

  it('formats timestamps with the same month names as dates (Sep, not Sept)', () => {
    const createdAt = new Date(2026, 8, 30, 14, 52).toISOString(); // local 30 Sep 2026 14:52
    expect(formatDateTime(createdAt)).toBe('30 Sep 2026, 14:52');
    expect(formatDateTime(new Date(2026, 5, 3, 9, 5).toISOString())).toBe('03 Jun 2026, 09:05');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
  });
});
