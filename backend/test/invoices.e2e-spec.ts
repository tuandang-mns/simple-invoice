/**
 * End-to-end: real NestJS app (same pipes/filters as production) + real PostgreSQL
 * started by Testcontainers, with the real migrations applied. Requires Docker.
 *
 * Workflow covered: login → create invoice → it appears in the list with server-calculated
 * totals and Draft status → detail → duplicate number rejected by the DB (409) → auth enforced.
 */
import type { PrismaClient } from '@prisma/client';
import { startTestApp, type TestContext } from './support/test-app';

jest.setTimeout(180_000);

const EMAIL = 'e2e@simpleinvoice.dev';
const PASSWORD = 'E2ePassword!1';

describe('Invoices (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaClient;
  let token: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    prisma = ctx.prisma;
    await ctx.createUser(EMAIL, PASSWORD);
  });

  afterAll(() => ctx?.close());

  const http = () => ctx.http();
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('rejects unauthenticated access to /invoices', async () => {
    const res = await http().get('/invoices').expect(401);
    expect(res.body).toEqual({
      statusCode: 401,
      message: 'Missing access token',
      error: 'Unauthorized',
    });
  });

  it('logs in and returns the current user', async () => {
    const login = await http()
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    expect(login.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
    token = login.body.accessToken;

    const me = await http().get('/auth/me').set(auth()).expect(200);
    expect(me.body).toMatchObject({ email: EMAIL, fullname: 'E2E User' });
  });

  it('creates an invoice and finds it in the list with server-calculated totals', async () => {
    const created = await http()
      .post('/invoices')
      .set(auth())
      .send({
        invoiceNumber: 'E2E-0001',
        invoiceDate: '2099-01-01',
        dueDate: '2099-01-31',
        currency: 'AUD',
        customer: { fullname: 'Zelda Customer', email: 'zelda@example.com' },
        items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
        discount: 20,
        // taxRate omitted → defaults to 10%
      })
      .expect(201);

    expect(created.body).toMatchObject({
      invoiceNumber: 'E2E-0001',
      status: 'Draft',
      currencySymbol: 'AU$',
      invoiceSubTotal: 2000,
      totalTax: 200,
      totalDiscount: 20,
      totalAmount: 2180,
      totalPaid: 0,
      balanceAmount: 2180,
    });

    const list = await http()
      .get('/invoices')
      .query({ keyword: 'zelda', status: 'Draft' })
      .set(auth())
      .expect(200);

    expect(list.body.paging).toEqual({ page: 1, pageSize: 10, total: 1 });
    expect(list.body.data[0]).toMatchObject({
      invoiceId: created.body.invoiceId,
      invoiceNumber: 'E2E-0001',
      totalAmount: 2180,
      status: 'Draft',
    });

    const detail = await http().get(`/invoices/${created.body.invoiceId}`).set(auth()).expect(200);
    expect(detail.body.items).toEqual([
      expect.objectContaining({ name: 'Honda RC150', quantity: 2, rate: 1000, amount: 2000 }),
    ]);
  });

  it('enforces unique invoice numbers at the database level (case-insensitive) → 409', async () => {
    const res = await http()
      .post('/invoices')
      .set(auth())
      .send({
        invoiceNumber: 'e2e-0001',
        invoiceDate: '2099-02-01',
        dueDate: '2099-02-01',
        currency: 'USD',
        customer: { fullname: 'Other', email: 'other@example.com' },
        items: [{ name: 'Thing', quantity: 1, rate: 1 }],
      })
      .expect(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('derives Overdue at read time without storing it', async () => {
    const { invoiceId } = (
      await http()
        .post('/invoices')
        .set(auth())
        .send({
          invoiceNumber: 'E2E-PAST',
          invoiceDate: '2020-01-01',
          dueDate: '2020-01-15',
          currency: 'SGD',
          customer: { fullname: 'Late Payer', email: 'late@example.com' },
          items: [{ name: 'Old work', quantity: 1, rate: 50 }],
        })
        .expect(201)
    ).body as { invoiceId: string };

    const detail = await http().get(`/invoices/${invoiceId}`).set(auth()).expect(200);
    expect(detail.body.status).toBe('Overdue');

    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(stored.status).toBe('Draft'); // never persisted as Overdue

    const overdue = await http()
      .get('/invoices')
      .query({ status: 'Overdue' })
      .set(auth())
      .expect(200);
    const numbers = (overdue.body as { data: { invoiceNumber: string }[] }).data.map(
      (i) => i.invoiceNumber,
    );
    expect(numbers).toEqual(['E2E-PAST']);
  });

  it('rejects client attempts to set totals, status or createdBy (400, not silently ignored)', async () => {
    const res = await http()
      .post('/invoices')
      .set(auth())
      .send({
        invoiceNumber: 'E2E-HACK',
        invoiceDate: '2099-01-01',
        dueDate: '2099-01-01',
        currency: 'AUD',
        customer: { fullname: 'X', email: 'x@example.com' },
        items: [{ name: 'Y', quantity: 1, rate: 100 }],
        totalAmount: 1,
        status: 'Paid',
        createdBy: '00000000-0000-4000-8000-000000000000',
      })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'property totalAmount should not exist',
        'property status should not exist',
        'property createdBy should not exist',
      ]),
    );
  });

  it('answers a missing customer object with 400, not 500', async () => {
    const res = await http()
      .post('/invoices')
      .set(auth())
      .send({
        invoiceNumber: 'E2E-NOCUST',
        invoiceDate: '2099-01-01',
        dueDate: '2099-01-01',
        currency: 'AUD',
        items: [{ name: 'Y', quantity: 1, rate: 1 }],
      })
      .expect(400);
    expect(res.body.message).toContain('customer is required');
  });

  it('returns structured validation errors', async () => {
    const res = await http()
      .post('/invoices')
      .set(auth())
      .send({
        invoiceNumber: 'E2E-BAD',
        invoiceDate: '2099-03-10',
        dueDate: '2099-03-01',
        currency: 'AUD',
        customer: { fullname: 'X', email: 'x@example.com' },
        items: [{ name: 'Y', quantity: 1, rate: 1 }],
      })
      .expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: ['dueDate must be on or after invoiceDate'],
      error: 'Bad Request',
    });
  });

  it('returns 404 for an unknown invoice id', async () => {
    const res = await http()
      .get('/invoices/00000000-0000-4000-8000-000000000000')
      .set(auth())
      .expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: 'Invoice not found', error: 'Not Found' });
  });
});
