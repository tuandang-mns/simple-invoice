import { deriveInvoiceStatus, isDueDateValid } from './invoice-status';

describe('deriveInvoiceStatus (Overdue is derived, never stored)', () => {
  const today = '2026-09-29';

  it.each([
    ['Pending', '2026-09-28', 'Overdue'],
    ['Draft', '2026-09-28', 'Overdue'], // literal spec rule: any non-Paid status
    ['Paid', '2026-01-01', 'Paid'], // paid invoices are never overdue
    ['Pending', '2026-09-29', 'Pending'], // due today is NOT overdue
    ['Pending', '2026-09-30', 'Pending'],
    ['Draft', '2026-12-31', 'Draft'],
  ] as const)('%s due %s → %s', (persisted, dueDate, expected) => {
    expect(deriveInvoiceStatus(persisted, dueDate, today)).toBe(expected);
  });

  it('handles month/year boundaries (string dates compare chronologically)', () => {
    expect(deriveInvoiceStatus('Pending', '2025-12-31', '2026-01-01')).toBe('Overdue');
    expect(deriveInvoiceStatus('Pending', '2026-10-01', '2026-09-30')).toBe('Pending');
  });
});

describe('isDueDateValid', () => {
  it('accepts a due date after the invoice date', () => {
    expect(isDueDateValid('2026-06-03', '2026-07-03')).toBe(true);
  });

  it('accepts a due date on the invoice date', () => {
    expect(isDueDateValid('2026-06-03', '2026-06-03')).toBe(true);
  });

  it('rejects a due date before the invoice date', () => {
    expect(isDueDateValid('2026-06-03', '2026-06-02')).toBe(false);
  });
});
