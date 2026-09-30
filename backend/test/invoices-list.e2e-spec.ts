/**
 * List & detail behaviour against the real seed dataset (Appendix A + 40 generated invoices).
 * Focus: properties that must hold for ANY data — partitioning, stable paging, ordering, bounds.
 */
import { todayIn } from '../src/common/utils/date.util';
import { insertSeedInvoices } from '../src/database/seed/seed-invoices';
import { startTestApp, TEST_TIMEZONE, type TestContext } from './support/test-app';

jest.setTimeout(180_000);

interface Row {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  customer: { fullname: string };
  createdAt: string;
}
interface ListBody {
  data: Row[];
  paging: { page: number; pageSize: number; total: number };
}

const APPENDIX_A_ID = '099ca7da-a290-40fa-93b9-1c43ae7bb887';

describe('Invoices — list & detail (e2e)', () => {
  let ctx: TestContext;
  let token: string;
  let seeded: number;
  const today = todayIn(TEST_TIMEZONE);

  beforeAll(async () => {
    ctx = await startTestApp();
    const userId = await ctx.createUser('lister@simpleinvoice.dev', 'ListerPass!1');
    seeded = await insertSeedInvoices(ctx.prisma, userId, today);
    token = await ctx.login('lister@simpleinvoice.dev', 'ListerPass!1');
  });

  afterAll(() => ctx?.close());

  const list = async (query: Record<string, string | number> = {}, status = 200) =>
    (
      await ctx
        .http()
        .get('/invoices')
        .query(query)
        .set({ Authorization: `Bearer ${token}` })
        .expect(status)
    ).body as ListBody;

  const all = (query: Record<string, string | number> = {}) => list({ pageSize: 100, ...query });

  describe('envelope & defaults', () => {
    it('returns { data, paging } with page 1 / pageSize 10 and the full total', async () => {
      const body = await list();
      expect(Object.keys(body)).toEqual(['data', 'paging']);
      expect(body.paging).toEqual({ page: 1, pageSize: 10, total: seeded });
      expect(body.data).toHaveLength(10);
    });

    it('defaults to newest created first', async () => {
      const { data } = await all();
      const created = data.map((r) => r.createdAt);
      expect(created).toEqual([...created].sort().reverse());
    });
  });

  describe('pagination', () => {
    it('visits every invoice exactly once when walking all pages (stable tie-break)', async () => {
      const pageSize = 7;
      const pages = Math.ceil(seeded / pageSize);
      const ids: string[] = [];
      for (let page = 1; page <= pages; page++) {
        // Sorting by a column with ties is where unstable paging shows up.
        const body = await list({ page, pageSize, sortBy: 'dueDate', ordering: 'ASC' });
        ids.push(...body.data.map((r) => r.invoiceId));
      }
      expect(ids).toHaveLength(seeded);
      expect(new Set(ids).size).toBe(seeded);
    });

    it('returns an empty page with the real total when paging past the end', async () => {
      const body = await list({ page: 999 });
      expect(body.data).toEqual([]);
      expect(body.paging.total).toBe(seeded);
    });
  });

  describe('status filter (Overdue derived at read time)', () => {
    it('partitions the dataset: the four filters sum to the unfiltered total', async () => {
      const totals = await Promise.all(
        ['Draft', 'Pending', 'Paid', 'Overdue'].map(
          async (status) => (await list({ status })).paging.total,
        ),
      );
      expect(totals.every((t) => t > 0)).toBe(true);
      expect(totals.reduce((a, b) => a + b, 0)).toBe(seeded);
    });

    it.each(['Draft', 'Pending', 'Paid', 'Overdue'])(
      'every row returned for %s renders that same status',
      async (status) => {
        const { data } = await all({ status });
        expect(data.every((r) => r.status === status)).toBe(true);
      },
    );

    it('Overdue rows are past due; Draft/Pending rows are not', async () => {
      expect((await all({ status: 'Overdue' })).data.every((r) => r.dueDate < today)).toBe(true);
      expect((await all({ status: 'Pending' })).data.every((r) => r.dueDate >= today)).toBe(true);
      expect((await all({ status: 'Draft' })).data.every((r) => r.dueDate >= today)).toBe(true);
    });
  });

  describe('sorting', () => {
    const cases: [string, (r: Row) => string | number][] = [
      ['invoiceDate', (r) => r.invoiceDate],
      ['dueDate', (r) => r.dueDate],
      ['totalAmount', (r) => r.totalAmount],
    ];

    it.each(cases)('sorts by %s ascending and descending', async (sortBy, key) => {
      const asc = (await all({ sortBy, ordering: 'ASC' })).data.map(key);
      const desc = (await all({ sortBy, ordering: 'desc' })).data.map(key); // case-insensitive
      const sorted = [...asc].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(asc).toEqual(sorted);
      expect(desc).toEqual([...sorted].reverse());
    });
  });

  describe('search', () => {
    it('matches the invoice number partially and case-insensitively', async () => {
      const { data } = await all({ keyword: 'iv1780' });
      expect(data.map((r) => r.invoiceNumber)).toEqual(['IV1780488206995']);
    });

    it('matches the customer name partially and case-insensitively', async () => {
      const { data } = await all({ keyword: 'OLIV' });
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((r) => r.customer.fullname.toLowerCase().includes('oliv'))).toBe(true);
    });

    it('searches invoice number OR customer name', async () => {
      const byNumber = await all({ keyword: 'INV-' });
      const byName = await all({ keyword: 'paul' });
      expect(byNumber.paging.total).toBe(seeded - 1); // every generated invoice, not Appendix A
      expect(byName.data.map((r) => r.invoiceNumber)).toContain('IV1780488206995');
    });

    it('treats LIKE wildcards literally (% and _ do not match everything)', async () => {
      expect((await list({ keyword: '%' })).paging.total).toBe(0);
      expect((await list({ keyword: '_' })).paging.total).toBe(0);
    });

    it('returns an empty result for no match', async () => {
      expect(await list({ keyword: 'zzz-no-such-thing' })).toEqual({
        data: [],
        paging: { page: 1, pageSize: 10, total: 0 },
      });
    });
  });

  describe('date range (invoiceDate, inclusive)', () => {
    it('includes an invoice dated exactly on both bounds', async () => {
      const { data } = await all({ fromDate: '2026-06-03', toDate: '2026-06-03' });
      expect(data.map((r) => r.invoiceNumber)).toContain('IV1780488206995');
      expect(data.every((r) => r.invoiceDate === '2026-06-03')).toBe(true);
    });

    it('keeps every row within the range', async () => {
      const fromDate = '2026-01-01';
      const toDate = today;
      const { data } = await all({ fromDate, toDate });
      expect(data.every((r) => r.invoiceDate >= fromDate && r.invoiceDate <= toDate)).toBe(true);
    });
  });

  it('applies search, filter, sort and pagination together', async () => {
    const query = { keyword: 'inv-', status: 'Paid', sortBy: 'totalAmount', ordering: 'ASC' };
    const everything = await all(query);
    const page2 = await list({ ...query, page: 2, pageSize: 3 });
    expect(page2.paging.total).toBe(everything.paging.total);
    expect(page2.data).toEqual(everything.data.slice(3, 6));
    expect(page2.data.every((r) => r.status === 'Paid' && r.invoiceNumber.startsWith('INV-'))).toBe(
      true,
    );
  });

  describe('query validation', () => {
    it.each([
      [
        { status: 'Late' },
        'status must be one of the following values: Draft, Pending, Paid, Overdue',
      ],
      [
        { sortBy: 'customerEmail' },
        'sortBy must be one of the following values: invoiceDate, dueDate, totalAmount',
      ],
      [{ ordering: 'sideways' }, 'ordering must be one of the following values: ASC, DESC'],
      [{ pageSize: 101 }, 'pageSize must not be greater than 100'],
      [{ page: 0 }, 'page must not be less than 1'],
      [{ fromDate: '03/06/2026' }, 'fromDate must be in YYYY-MM-DD format'],
      [{ fromDate: '2026-06-10', toDate: '2026-06-01' }, 'toDate must be on or after fromDate'],
    ])('rejects %j with a 400 listing the problem', async (query, message) => {
      const body = (await list(query, 400)) as unknown as { message: string[] };
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(body.message).toContain(message);
    });
  });

  describe('detail', () => {
    it('returns the Appendix A invoice with every figure the detail screen needs', async () => {
      const res = await ctx
        .http()
        .get(`/invoices/${APPENDIX_A_ID}`)
        .set({ Authorization: `Bearer ${token}` })
        .expect(200);
      expect(res.body).toMatchObject({
        invoiceNumber: 'IV1780488206995',
        status: 'Overdue', // stored as Pending; derived because the due date has passed
        currencySymbol: 'AU$',
        customer: { fullname: 'Paul', email: 'paul@101digital.io' },
        invoiceSubTotal: 2000,
        totalTax: 200,
        totalDiscount: 20,
        totalAmount: 2180,
        totalPaid: 1451.34,
        balanceAmount: 728.66,
        items: [
          expect.objectContaining({ name: 'Honda RC150', quantity: 2, rate: 1000, amount: 2000 }),
        ],
      });
      const stored = await ctx.prisma.invoice.findUniqueOrThrow({ where: { id: APPENDIX_A_ID } });
      expect(stored.status).toBe('Pending');
    });

    it('agrees with the list for the same invoice', async () => {
      const { data } = await all({ keyword: 'IV1780488206995' });
      const res = await ctx
        .http()
        .get(`/invoices/${APPENDIX_A_ID}`)
        .set({ Authorization: `Bearer ${token}` })
        .expect(200);
      const { items: _items, ...detailWithoutItems } = res.body as Row & { items: unknown };
      void _items;
      expect(detailWithoutItems).toEqual(data[0]);
    });
  });

  it('answers unknown routes with the standard error shape', async () => {
    const res = await ctx
      .http()
      .get('/nope')
      .set({ Authorization: `Bearer ${token}` })
      .expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: 'Cannot GET /nope', error: 'Not Found' });
  });
});
