import { calculateInvoiceTotals, InvoiceCalculationError } from './invoice-calculator';

describe('calculateInvoiceTotals', () => {
  it('matches the Appendix A reference invoice exactly', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 20,
      totalPaid: 1451.34,
    });

    expect(totals.subTotal.toNumber()).toBe(2000);
    expect(totals.taxAmount.toNumber()).toBe(200);
    expect(totals.discount.toNumber()).toBe(20);
    expect(totals.totalAmount.toNumber()).toBe(2180);
    expect(totals.totalPaid.toNumber()).toBe(1451.34);
    expect(totals.balanceAmount.toNumber()).toBe(728.66);
  });

  it('uses decimal arithmetic (no floating point drift)', () => {
    // In JS floats: 3 * 0.1 = 0.30000000000000004
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 3, rate: 0.1 }],
      taxRate: 0,
      discount: 0,
    });
    expect(totals.subTotal.toString()).toBe('0.3');
    expect(totals.totalAmount.toString()).toBe('0.3');
  });

  it('rounds tax half-up to 2 decimal places', () => {
    // 59.97 × 10% = 5.997 → 6.00
    const a = calculateInvoiceTotals({
      items: [{ quantity: 3, rate: 19.99 }],
      taxRate: 10,
      discount: 0,
    });
    expect(a.taxAmount.toFixed(2)).toBe('6.00');
    // 0.05 × 10% = 0.005 → 0.01 (half-up, not banker's rounding)
    const b = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 0.05 }],
      taxRate: 10,
      discount: 0,
    });
    expect(b.taxAmount.toFixed(2)).toBe('0.01');
  });

  it('defaults totalPaid to 0 so balance equals total for new invoices', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 100 }],
      taxRate: 10,
      discount: 0,
    });
    expect(totals.totalPaid.toNumber()).toBe(0);
    expect(totals.balanceAmount.toNumber()).toBe(110);
  });

  it('supports zero tax', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 4, rate: 25 }],
      taxRate: 0,
      discount: 10,
    });
    expect(totals.taxAmount.toNumber()).toBe(0);
    expect(totals.totalAmount.toNumber()).toBe(90);
  });

  it('sums multiple line items (model supports more than one item)', () => {
    const totals = calculateInvoiceTotals({
      items: [
        { quantity: 2, rate: 10 },
        { quantity: 1, rate: 5.5 },
      ],
      taxRate: 10,
      discount: 0,
    });
    expect(totals.lineAmounts.map((a) => a.toNumber())).toEqual([20, 5.5]);
    expect(totals.subTotal.toNumber()).toBe(25.5);
    expect(totals.totalAmount.toNumber()).toBe(28.05);
  });

  it('allows a discount equal to subtotal + tax (total becomes 0)', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 100 }],
      taxRate: 10,
      discount: 110,
    });
    expect(totals.totalAmount.toNumber()).toBe(0);
  });

  it('rejects a discount larger than subtotal + tax (no negative invoices)', () => {
    expect(() =>
      calculateInvoiceTotals({
        items: [{ quantity: 1, rate: 100 }],
        taxRate: 10,
        discount: 110.01,
      }),
    ).toThrow(InvoiceCalculationError);
  });

  it('rejects an invoice without line items', () => {
    expect(() => calculateInvoiceTotals({ items: [], taxRate: 10, discount: 0 })).toThrow(
      InvoiceCalculationError,
    );
  });

  describe('currency scale (ISO 4217 minor units)', () => {
    it('rounds VND (0 minor units) to whole dong', () => {
      // 3 × 33,333 = 99,999; tax 10% = 9,999.9 → 10,000 (half-up); total 109,999
      const totals = calculateInvoiceTotals({
        items: [{ quantity: 3, rate: 33_333 }],
        taxRate: 10,
        discount: 0,
        scale: 0,
      });
      expect(totals.subTotal.toString()).toBe('99999');
      expect(totals.taxAmount.toString()).toBe('10000');
      expect(totals.totalAmount.toString()).toBe('109999');
    });

    it('never produces a fractional dong, even with odd tax rates', () => {
      const totals = calculateInvoiceTotals({
        items: [{ quantity: 7, rate: 12_345 }],
        taxRate: 7.25,
        discount: 1_000,
        scale: 0,
      });
      for (const v of [
        totals.subTotal,
        totals.taxAmount,
        totals.totalAmount,
        totals.balanceAmount,
      ]) {
        expect(v.decimalPlaces()).toBe(0);
      }
      expect(totals.taxAmount.toNumber()).toBe(6265); // 86,415 × 7.25% = 6,265.09 → 6,265
    });

    it('keeps 2 decimals by default (AUD, USD, ...)', () => {
      const totals = calculateInvoiceTotals({
        items: [{ quantity: 3, rate: 19.99 }],
        taxRate: 10,
        discount: 0,
      });
      expect(totals.taxAmount.toFixed(2)).toBe('6.00');
      expect(totals.totalAmount.toFixed(2)).toBe('65.97');
    });
  });
});
