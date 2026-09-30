import { addDays } from '../../common/utils/date.util';
import { deriveInvoiceStatus } from '../../invoices/domain/invoice-status';
import { generateInvoices } from './seed-data';
import { assertAppendixAFigures } from './seed-invoices';

describe('seed data', () => {
  it('reproduces the Appendix A published figures exactly', () => {
    expect(() => assertAppendixAFigures()).not.toThrow();
  });

  it('covers every status (incl. derived Overdue) whatever day it runs', () => {
    for (const today of ['2026-01-01', '2026-09-29', '2027-06-15']) {
      const statuses = new Set(
        generateInvoices(today).map((i) => deriveInvoiceStatus(i.status, i.dueDate, today)),
      );
      expect([...statuses].sort()).toEqual(['Draft', 'Overdue', 'Paid', 'Pending']);
    }
  });

  it('includes VND invoices with whole-dong amounts only', () => {
    const vnd = generateInvoices('2026-09-30').filter((i) => i.currency === 'VND');
    expect(vnd.length).toBeGreaterThan(0);
    for (const invoice of vnd) {
      expect(Number.isInteger(invoice.item.rate)).toBe(true);
      expect(Number.isInteger(invoice.discount)).toBe(true);
    }
  });

  it('never generates a due date before the invoice date or an invoice in the future', () => {
    const today = '2026-09-29';
    for (const invoice of generateInvoices(today)) {
      expect(invoice.dueDate >= invoice.invoiceDate).toBe(true);
      expect(invoice.invoiceDate <= today).toBe(true);
    }
    expect(addDays(today, 0)).toBe(today);
  });
});
