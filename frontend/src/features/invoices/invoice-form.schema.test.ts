import { describe, expect, it } from 'vitest';
import { hasAtMostTwoDecimals, invoiceFormSchema } from './invoice-form.schema';

const valid = {
  invoiceNumber: 'INV-1',
  invoiceReference: '',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD' as const,
  description: '',
  customerName: 'Paul',
  customerEmail: 'paul@101digital.io',
  customerMobile: '',
  customerAddress: '',
  itemName: 'Honda RC150',
  quantity: '2',
  rate: '1000',
  taxRate: '10',
  discount: '20',
};

describe('invoice form schema — money inputs', () => {
  it('accepts EVERY 2-decimal price from 0.01 to 999.99 (regression: float check rejected ~9%)', () => {
    const rejected: string[] = [];
    for (let cents = 1; cents < 100_000; cents++) {
      const rate = (cents / 100).toFixed(2);
      if (!invoiceFormSchema.safeParse({ ...valid, rate, discount: '0' }).success)
        rejected.push(rate);
    }
    expect(rejected).toEqual([]);
  });

  it.each(['19.99', '1.10', '1.1', '2200.01', '0.07'])('accepts %s', (v) => {
    expect(hasAtMostTwoDecimals(v)).toBe(true);
  });

  it.each(['10.999', '0.001', '5.1234'])('rejects %s (more than 2 decimals)', (v) => {
    const r = invoiceFormSchema.safeParse({ ...valid, rate: v });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain('Max 2 decimal places');
  });

  it('applies the same rule to tax and discount', () => {
    const r = invoiceFormSchema.safeParse({ ...valid, taxRate: '7.125', discount: '1.005' });
    expect(r.error?.issues.map((i) => `${i.path[0]}: ${i.message}`)).toEqual([
      'taxRate: Max 2 decimal places',
      'discount: Max 2 decimal places',
    ]);
  });

  it('mirrors the API caps on quantity and rate', () => {
    const r = invoiceFormSchema.safeParse({
      ...valid,
      quantity: '100001',
      rate: '100000000.01',
      discount: '0',
    });
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      'Quantity cannot exceed 100,000',
      'Rate cannot exceed 100,000,000',
    ]);
    expect(
      invoiceFormSchema.safeParse({
        ...valid,
        quantity: '100000',
        rate: '100000000',
        discount: '0',
      }).success,
    ).toBe(true);
  });

  it('rejects implausible years', () => {
    const r = invoiceFormSchema.safeParse({
      ...valid,
      invoiceDate: '9999-12-30',
      dueDate: '9999-12-31',
    });
    expect(r.error?.issues.map((i) => i.message)).toContain('Year must be between 1900 and 2999');
  });

  it('requires whole numbers for VND rate and discount', () => {
    const r = invoiceFormSchema.safeParse({
      ...valid,
      currency: 'VND',
      rate: '1000.5',
      discount: '0.5',
    });
    expect(r.error?.issues.map((i) => `${i.path[0]}: ${i.message}`)).toEqual([
      'rate: Whole numbers only for VND',
      'discount: Whole numbers only for VND',
    ]);
    expect(
      invoiceFormSchema.safeParse({ ...valid, currency: 'VND', rate: '1650000', discount: '5000' })
        .success,
    ).toBe(true);
  });
});
