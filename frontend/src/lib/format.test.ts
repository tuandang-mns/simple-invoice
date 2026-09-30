import { describe, expect, it } from 'vitest';
import { addDaysIso, formatDate, formatMoney } from './format';

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

  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
  });
});
