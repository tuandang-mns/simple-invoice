/** Statuses persisted in the database. */
export const PERSISTED_STATUSES = ['Draft', 'Pending', 'Paid'] as const;
export type PersistedStatus = (typeof PERSISTED_STATUSES)[number];

/** Statuses exposed by the API — Overdue is derived, never stored. */
export const INVOICE_STATUSES = ['Draft', 'Pending', 'Paid', 'Overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Overdue derivation (spec §2.3.2):
 *   status != Paid AND dueDate < today  → Overdue
 *   otherwise                           → persisted status
 *
 * Dates are "YYYY-MM-DD" strings, which compare correctly as strings.
 * A due date equal to today is NOT overdue.
 */
export function deriveInvoiceStatus(
  persisted: PersistedStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  if (persisted !== 'Paid' && dueDate < today) {
    return 'Overdue';
  }
  return persisted;
}

/** Due date must be on or after the invoice date. */
export function isDueDateValid(invoiceDate: string, dueDate: string): boolean {
  return dueDate >= invoiceDate;
}
