import { Prisma } from '@prisma/client';
import { toDbDate } from '../common/utils/date.util';
import type { InvoiceStatus } from './domain/invoice-status';
import type { ListInvoicesQueryDto, SortableField } from './dto/list-invoices-query.dto';

/**
 * Overdue is derived, so every status filter must be expressed in terms of
 * (persisted status, due_date, today) — otherwise counts and pagination are wrong.
 *
 *   Overdue → status <> Paid    AND due_date <  today
 *   Pending → status =  Pending AND due_date >= today
 *   Draft   → status =  Draft   AND due_date >= today
 *   Paid    → status =  Paid
 */
export function statusFilter(status: InvoiceStatus, today: string): Prisma.InvoiceWhereInput {
  const todayDate = toDbDate(today);
  switch (status) {
    case 'Overdue':
      return { status: { not: 'Paid' }, dueDate: { lt: todayDate } };
    case 'Pending':
    case 'Draft':
      return { status, dueDate: { gte: todayDate } };
    case 'Paid':
      return { status: 'Paid' };
  }
}

/**
 * Prisma's `contains` becomes `ILIKE '%<value>%'` WITHOUT escaping, so a user typing `%` or `_`
 * would match everything. Escape LIKE metacharacters (backslash is Postgres' default escape).
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function buildInvoiceWhere(
  query: Pick<ListInvoicesQueryDto, 'status' | 'keyword' | 'fromDate' | 'toDate'>,
  today: string,
): Prisma.InvoiceWhereInput {
  const and: Prisma.InvoiceWhereInput[] = [];

  if (query.status) {
    and.push(statusFilter(query.status, today));
  }

  if (query.keyword) {
    // Prisma "contains + insensitive" compiles to ILIKE '%keyword%' (served by trigram indexes).
    const keyword = escapeLike(query.keyword);
    and.push({
      OR: [
        { invoiceNumber: { contains: keyword, mode: 'insensitive' } },
        { customerFullname: { contains: keyword, mode: 'insensitive' } },
      ],
    });
  }

  if (query.fromDate || query.toDate) {
    and.push({
      invoiceDate: {
        ...(query.fromDate && { gte: toDbDate(query.fromDate) }),
        ...(query.toDate && { lte: toDbDate(query.toDate) }),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

const SORT_COLUMNS: Record<SortableField, keyof Prisma.InvoiceOrderByWithRelationInput> = {
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  totalAmount: 'totalAmount',
};

/** Always appends `id` as a tie-breaker so rows never jump between pages. */
export function buildInvoiceOrderBy(
  query: Pick<ListInvoicesQueryDto, 'sortBy' | 'ordering'>,
): Prisma.InvoiceOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = query.ordering === 'ASC' ? 'asc' : 'desc';
  const primary = query.sortBy ? SORT_COLUMNS[query.sortBy] : 'createdAt';
  return [{ [primary]: direction }, { id: 'asc' }];
}
