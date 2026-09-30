import { toDbDate } from '../common/utils/date.util';
import {
  buildInvoiceOrderBy,
  buildInvoiceWhere,
  escapeLike,
  statusFilter,
} from './invoice-query.builder';

const today = '2026-09-29';
const todayDate = toDbDate(today);

describe('statusFilter — derived Overdue translated to SQL predicates', () => {
  it('Overdue = not Paid and due before today', () => {
    expect(statusFilter('Overdue', today)).toEqual({
      status: { not: 'Paid' },
      dueDate: { lt: todayDate },
    });
  });

  it('Pending/Draft exclude rows that are actually overdue', () => {
    expect(statusFilter('Pending', today)).toEqual({
      status: 'Pending',
      dueDate: { gte: todayDate },
    });
    expect(statusFilter('Draft', today)).toEqual({ status: 'Draft', dueDate: { gte: todayDate } });
  });

  it('Paid is never affected by due date', () => {
    expect(statusFilter('Paid', today)).toEqual({ status: 'Paid' });
  });
});

describe('buildInvoiceWhere', () => {
  it('returns an empty filter when nothing is requested', () => {
    expect(buildInvoiceWhere({}, today)).toEqual({});
  });

  it('searches invoice number OR customer name, case-insensitively', () => {
    expect(buildInvoiceWhere({ keyword: 'pau' }, today)).toEqual({
      AND: [
        {
          OR: [
            { invoiceNumber: { contains: 'pau', mode: 'insensitive' } },
            { customerFullname: { contains: 'pau', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('applies an inclusive invoiceDate range', () => {
    expect(buildInvoiceWhere({ fromDate: '2026-01-01', toDate: '2026-01-31' }, today)).toEqual({
      AND: [{ invoiceDate: { gte: toDbDate('2026-01-01'), lte: toDbDate('2026-01-31') } }],
    });
  });

  it('combines status, keyword and dates with AND', () => {
    const where = buildInvoiceWhere(
      { status: 'Paid', keyword: 'x', fromDate: '2026-01-01' },
      today,
    );
    expect(where.AND).toHaveLength(3);
  });
});

describe('buildInvoiceOrderBy', () => {
  it('defaults to newest created first with an id tie-breaker', () => {
    expect(buildInvoiceOrderBy({})).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it('sorts by the requested field and direction', () => {
    expect(buildInvoiceOrderBy({ sortBy: 'totalAmount', ordering: 'ASC' })).toEqual([
      { totalAmount: 'asc' },
      { id: 'asc' },
    ]);
  });
});

describe('escapeLike (search must treat % and _ literally)', () => {
  it.each([
    ['%', '\\%'],
    ['_', '\\_'],
    ['50%_off', '50\\%\\_off'],
    ['a\\b', 'a\\\\b'],
    ['INV-2026', 'INV-2026'],
  ])('%s → %s', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });

  it('is applied to the keyword filter', () => {
    const where = buildInvoiceWhere({ keyword: '100%' }, today);
    expect(JSON.stringify(where)).toContain('100\\\\%');
  });
});
