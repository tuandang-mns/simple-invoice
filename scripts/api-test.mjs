#!/usr/bin/env node
/**
 * Black-box API test run against a RUNNING stack (e.g. `docker compose up`).
 * No dependencies — Node 22 built-in fetch. Case IDs match docs/TEST-CASES.md.
 *
 *   node scripts/api-test.mjs                         # http://localhost:3000, seeded demo user
 *   API_URL=http://host:3000 node scripts/api-test.mjs
 *   RUN_RATE_LIMIT=1 node scripts/api-test.mjs        # also checks login throttling (locks login ~60s)
 *
 * Creates a few invoices with a unique run suffix; safe to run repeatedly.
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.SEED_USER_EMAIL ?? 'admin@simpleinvoice.dev';
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';
const RUN = Date.now().toString(36).toUpperCase();

let token = '';
const results = [];

async function call(method, path, { body, auth = true, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(auth && token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${what}: expected ${e}, got ${a}`);
}

async function test(id, title, fn) {
  try {
    await fn();
    results.push({ id, title, ok: true });
    console.log(`  ✔ ${id}  ${title}`);
  } catch (error) {
    results.push({ id, title, ok: false, error: error.message });
    console.log(`  ✖ ${id}  ${title}\n      → ${error.message}`);
  }
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE ?? 'Asia/Singapore' }).format(new Date());
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const newInvoice = (overrides = {}) => ({
  invoiceNumber: `API-${RUN}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  invoiceDate: today,
  dueDate: addDays(today, 30),
  currency: 'AUD',
  customer: { fullname: 'Paul', email: 'paul@101digital.io', mobileNumber: '947717364111', address: 'Singapore' },
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
  taxRate: 10,
  discount: 20,
  ...overrides,
});
const listAll = async (query = '') => (await call('GET', `/invoices?pageSize=100${query}`)).body;

console.log(`\nSimpleInvoice API test — ${API} — run ${RUN} — today ${today}\n`);

// ---------------------------------------------------------------- platform
console.log('Platform');
await test('TC-API-01', 'GET /health is public and reports the DB up', async () => {
  const r = await call('GET', '/health', { auth: false });
  eq(r.status, 200, 'status');
  eq(r.body, { status: 'ok' }, 'body');
});
await test('TC-API-02', 'Swagger UI and OpenAPI JSON are served with all 5 spec endpoints', async () => {
  eq((await call('GET', '/api/docs', { auth: false })).status, 200, 'docs status');
  const spec = (await call('GET', '/api/docs-json', { auth: false })).body;
  for (const p of ['/auth/login', '/auth/me', '/invoices', '/invoices/{id}']) assert(spec.paths[p], `missing ${p}`);
  assert(spec.paths['/invoices'].get && spec.paths['/invoices'].post, 'GET+POST /invoices documented');
  const params = spec.paths['/invoices'].get.parameters.map((p) => p.name).sort();
  eq(params, ['fromDate', 'keyword', 'ordering', 'page', 'pageSize', 'sortBy', 'status', 'toDate'], 'list query params');
});
await test('TC-API-03', 'Security headers and request id are returned', async () => {
  const r = await call('GET', '/health', { auth: false, headers: { 'x-request-id': `trace-${RUN}` } });
  eq(r.headers.get('x-request-id'), `trace-${RUN}`, 'x-request-id echoed');
  eq(r.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
  assert(r.headers.get('strict-transport-security'), 'HSTS present');
});

// ---------------------------------------------------------------- auth
console.log('Authentication');
await test('TC-AUTH-10', 'Protected endpoints reject missing / malformed / forged tokens with 401', async () => {
  for (const [path, authz] of [
    ['/invoices', undefined],
    ['/auth/me', undefined],
    ['/invoices', 'Token abc'],
    ['/invoices', 'Bearer not.a.jwt'],
    ['/invoices', 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.'],
  ]) {
    const r = await call('GET', path, { auth: false, headers: authz ? { authorization: authz } : {} });
    eq(r.status, 401, `${path} with ${authz ?? 'no token'}`);
    eq(Object.keys(r.body), ['statusCode', 'message', 'error'], 'error shape');
  }
});
await test('TC-AUTH-11', 'Login validation errors are returned as a message array (400)', async () => {
  const r = await call('POST', '/auth/login', { auth: false, body: { email: 'nope', password: '' } });
  eq(r.status, 400, 'status');
  eq(r.body.message, ['email must be a valid email address', 'password is required'], 'messages');
});
await test('TC-AUTH-12', 'Wrong password and unknown email get the identical 401 response', async () => {
  const a = await call('POST', '/auth/login', { auth: false, body: { email: EMAIL, password: 'wrong' } });
  const b = await call('POST', '/auth/login', { auth: false, body: { email: 'ghost@nowhere.io', password: 'wrong' } });
  eq(a.status, 401, 'status');
  eq(a.body, b.body, 'identical bodies');
  eq(a.body.message, 'Invalid email or password', 'message');
});
await test('TC-AUTH-13', 'Valid login returns a Bearer JWT (default 3600s) and profile without password hash', async () => {
  const r = await call('POST', '/auth/login', { auth: false, body: { email: EMAIL.toUpperCase(), password: PASSWORD } });
  eq(r.status, 200, 'status');
  eq(r.body.tokenType, 'Bearer', 'tokenType');
  eq(r.body.expiresIn, 3600, 'expiresIn');
  assert(r.body.accessToken.split('.').length === 3, 'JWT format');
  assert(!JSON.stringify(r.body).toLowerCase().includes('password'), 'no password field');
  token = r.body.accessToken;
});
await test('TC-AUTH-14', 'GET /auth/me returns the current user', async () => {
  const r = await call('GET', '/auth/me');
  eq(r.status, 200, 'status');
  eq(r.body.email, EMAIL, 'email');
});
await test('TC-AUTH-15', 'Unknown extra fields in the login body are rejected', async () => {
  const r = await call('POST', '/auth/login', { auth: false, body: { email: EMAIL, password: PASSWORD, role: 'admin' } });
  eq(r.status, 400, 'status');
  assert(r.body.message.includes('property role should not exist'), 'names the field');
});

// ---------------------------------------------------------------- list
console.log('Invoice list');
const baseline = (await call('GET', '/invoices')).body.paging.total;
await test('TC-LIST-API-01', 'Default page: { data, paging } with page 1, pageSize 10', async () => {
  const r = await call('GET', '/invoices');
  eq(r.status, 200, 'status');
  eq(Object.keys(r.body), ['data', 'paging'], 'envelope');
  eq([r.body.paging.page, r.body.paging.pageSize, r.body.data.length], [1, 10, 10], 'paging');
  const row = r.body.data[0];
  for (const f of ['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount', 'status']) assert(f in row, `row has ${f}`);
  assert(row.customer.fullname, 'row has customer name');
});
await test('TC-LIST-API-02', 'Status filters partition the set (Draft+Pending+Paid+Overdue = total)', async () => {
  let sum = 0;
  for (const s of ['Draft', 'Pending', 'Paid', 'Overdue']) {
    const body = await listAll(`&status=${s}`);
    assert(body.data.every((r) => r.status === s), `${s} rows all render ${s}`);
    if (s === 'Overdue') assert(body.data.every((r) => r.dueDate < today && r.status !== 'Paid'), 'overdue = past due');
    if (s === 'Pending' || s === 'Draft') assert(body.data.every((r) => r.dueDate >= today), `${s} not past due`);
    sum += body.paging.total;
  }
  eq(sum, baseline, 'sum of filters');
});
await test('TC-LIST-API-03', 'Search is partial + case-insensitive on invoice number OR customer name', async () => {
  eq((await listAll('&keyword=iv1780')).data.map((r) => r.invoiceNumber), ['IV1780488206995'], 'by number');
  const byName = await listAll('&keyword=PAU');
  assert(byName.data.some((r) => r.customer.fullname === 'Paul'), 'by name');
  eq((await call('GET', '/invoices?keyword=zzz-none')).body, { data: [], paging: { page: 1, pageSize: 10, total: 0 } }, 'no match');
  for (const wildcard of ['%', '_']) {
    eq((await call('GET', `/invoices?keyword=${encodeURIComponent(wildcard)}`)).body.paging.total, 0, `"${wildcard}" is literal`);
  }
});
await test('TC-LIST-API-04', 'Sort by invoiceDate / dueDate / totalAmount, ASC and DESC', async () => {
  for (const field of ['invoiceDate', 'dueDate', 'totalAmount']) {
    const asc = (await listAll(`&sortBy=${field}&ordering=ASC`)).data.map((r) => r[field]);
    const desc = (await listAll(`&sortBy=${field}&ordering=desc`)).data.map((r) => r[field]);
    const sorted = [...asc].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    eq(asc, sorted, `${field} ASC`);
    eq(desc, [...sorted].reverse(), `${field} DESC`);
  }
});
await test('TC-LIST-API-05', 'Pagination visits every invoice exactly once; past-the-end page is empty', async () => {
  const ids = [];
  for (let page = 1; page <= Math.ceil(baseline / 7); page++) {
    ids.push(...(await call('GET', `/invoices?page=${page}&pageSize=7&sortBy=dueDate&ordering=ASC`)).body.data.map((r) => r.invoiceId));
  }
  eq([ids.length, new Set(ids).size], [baseline, baseline], 'unique ids across pages');
  const past = (await call('GET', '/invoices?page=999')).body;
  eq([past.data.length, past.paging.total], [0, baseline], 'past the end');
});
await test('TC-LIST-API-06', 'Date range filters invoiceDate inclusively', async () => {
  const r = await listAll('&fromDate=2026-06-03&toDate=2026-06-03');
  assert(r.data.some((x) => x.invoiceNumber === 'IV1780488206995'), 'boundary day included');
  assert(r.data.every((x) => x.invoiceDate === '2026-06-03'), 'nothing outside range');
});
await test('TC-LIST-API-07', 'Invalid list parameters return 400 with every problem listed', async () => {
  const r = await call('GET', '/invoices?status=Late&sortBy=email&ordering=up&pageSize=500&page=0&fromDate=2026-06-10&toDate=2026-06-01');
  eq(r.status, 400, 'status');
  eq(r.body.message.length, 6, `6 messages (${r.body.message.join(' | ')})`);
});

// ---------------------------------------------------------------- detail
console.log('Invoice detail');
await test('TC-DETAIL-API-01', 'Appendix A invoice: every figure matches the spec; Overdue derived', async () => {
  const r = await call('GET', '/invoices/099ca7da-a290-40fa-93b9-1c43ae7bb887');
  eq(r.status, 200, 'status');
  const b = r.body;
  eq(
    [b.invoiceSubTotal, b.totalTax, b.totalDiscount, b.totalAmount, b.totalPaid, b.balanceAmount, b.status, b.currencySymbol],
    [2000, 200, 20, 2180, 1451.34, 728.66, 'Overdue', 'AU$'],
    'figures',
  );
  eq(b.items.map((i) => [i.name, i.quantity, i.rate, i.amount]), [['Honda RC150', 2, 1000, 2000]], 'line item');
});
await test('TC-DETAIL-API-02', 'Unknown id → 404 "Invoice not found"; non-UUID → 400', async () => {
  const missing = await call('GET', '/invoices/00000000-0000-4000-8000-000000000000');
  eq([missing.status, missing.body], [404, { statusCode: 404, message: 'Invoice not found', error: 'Not Found' }], '404');
  eq((await call('GET', '/invoices/not-a-uuid')).status, 400, '400');
});

// ---------------------------------------------------------------- create
console.log('Create invoice');
let created;
await test('TC-CREATE-API-01', 'Create with Appendix A inputs → 201, Draft, totals computed by the server', async () => {
  const r = await call('POST', '/invoices', { body: newInvoice({ invoiceNumber: `API-${RUN}-A` }) });
  eq(r.status, 201, 'status');
  created = r.body;
  eq(
    [created.status, created.invoiceSubTotal, created.totalTax, created.totalDiscount, created.totalAmount, created.totalPaid, created.balanceAmount],
    ['Draft', 2000, 200, 20, 2180, 0, 2180],
    'computed figures',
  );
});
await test('TC-CREATE-API-02', 'Created invoice appears in the list (search) and its detail matches', async () => {
  const hit = (await listAll(`&keyword=API-${RUN}-A`)).data;
  eq(hit.map((r) => r.invoiceId), [created.invoiceId], 'found in list');
  const detail = (await call('GET', `/invoices/${created.invoiceId}`)).body;
  eq(detail.totalAmount, 2180, 'detail total');
});
await test('TC-CREATE-API-03', 'Omitted tax/discount default to 10% / 0', async () => {
  const body = newInvoice();
  delete body.taxRate;
  delete body.discount;
  const r = await call('POST', '/invoices', { body });
  eq([r.status, r.body.taxRate, r.body.totalTax, r.body.totalDiscount, r.body.totalAmount], [201, 10, 200, 0, 2200], 'defaults');
});
await test('TC-CREATE-API-04', 'Rounding: 3 × 33.33 @10% → 99.99 + 10.00 = 109.99 (half-up)', async () => {
  const r = await call('POST', '/invoices', { body: newInvoice({ items: [{ name: 'Round', quantity: 3, rate: 33.33 }], discount: 0 }) });
  eq([r.body.invoiceSubTotal, r.body.totalTax, r.body.totalAmount], [99.99, 10, 109.99], 'rounded');
});
await test('TC-CREATE-API-05', 'Back-dated invoice is stored Draft but returned as Overdue', async () => {
  const r = await call('POST', '/invoices', { body: newInvoice({ invoiceDate: '2026-01-05', dueDate: '2026-02-05' }) });
  eq([r.status, r.body.status], [201, 'Overdue'], 'derived status');
});
await test('TC-CREATE-API-06', 'Due date equal to invoice date is accepted', async () => {
  eq((await call('POST', '/invoices', { body: newInvoice({ dueDate: today }) })).status, 201, 'status');
});
await test('TC-CREATE-API-07', 'Duplicate invoice number (any case) → 409 Conflict', async () => {
  const r = await call('POST', '/invoices', { body: newInvoice({ invoiceNumber: `api-${RUN}-a` }) });
  eq([r.status, r.body.error], [409, 'Conflict'], 'conflict');
});
await test('TC-CREATE-API-08', 'Due date before invoice date → 400 with the spec message', async () => {
  const r = await call('POST', '/invoices', { body: newInvoice({ invoiceDate: '2026-12-31', dueDate: '2026-12-01' }) });
  eq([r.status, r.body.message], [400, ['dueDate must be on or after invoiceDate']], 'message');
});
await test('TC-CREATE-API-09', 'Every field rule is enforced server-side', async () => {
  const cases = [
    [{ invoiceNumber: '' }, 'invoiceNumber should not be empty'],
    [{ customer: { fullname: '', email: 'x@y.io' } }, 'customer.fullname should not be empty'],
    [{ customer: { fullname: 'A', email: 'nope' } }, 'customer.email must be a valid email address'],
    [{ items: [{ name: 'x', quantity: 0, rate: 1 }] }, 'items.0.quantity must not be less than 1'],
    [{ items: [{ name: 'x', quantity: 1.5, rate: 1 }] }, 'items.0.quantity must be an integer number'],
    [{ items: [{ name: 'x', quantity: 1, rate: -5 }] }, 'items.0.rate must be a positive number'],
    [{ items: [{ name: '', quantity: 1, rate: 1 }] }, 'items.0.name should not be empty'],
    [{ taxRate: -1 }, 'taxRate must not be less than 0'],
    [{ discount: -1 }, 'discount must not be less than 0'],
    [{ invoiceDate: '2026-02-30' }, 'invoiceDate must be a valid date'],
    [{ currency: 'XYZ' }, 'currency must be one of: AUD, USD, GBP, SGD, EUR, VND'],
    [{ items: [] }, 'items must contain at least 1 elements'],
    [{ customer: undefined }, 'customer is required'],
    [{ items: [{ name: 'x', quantity: 100_001, rate: 1 }] }, 'items.0.quantity must not be greater than 100000'],
    [{ items: [{ name: 'x', quantity: 1, rate: 100_000_000.01 }] }, 'items.0.rate must not be greater than 100000000'],
    [{ invoiceDate: '9999-12-30', dueDate: '9999-12-31' }, 'invoiceDate year must be between 1900 and 2999'],
  ];
  for (const [override, message] of cases) {
    const r = await call('POST', '/invoices', { body: newInvoice(override) });
    assert(r.status === 400 && r.body.message.includes(message), `${JSON.stringify(override)} → expected "${message}", got ${r.status} ${JSON.stringify(r.body.message)}`);
  }
});
await test('TC-CREATE-API-10', 'Discount larger than subtotal + tax is rejected (no negative invoices)', async () => {
  const r = await call('POST', '/invoices', { body: newInvoice({ items: [{ name: 'x', quantity: 1, rate: 10 }], discount: 100 }) });
  eq([r.status, r.body.message], [400, ['discount must not exceed subtotal plus tax']], 'rejected');
});
await test('TC-CREATE-API-11', 'Client cannot set totals, status or createdBy', async () => {
  const r = await call('POST', '/invoices', { body: newInvoice({ totalAmount: 1, status: 'Paid', createdBy: created.createdBy }) });
  eq(r.status, 400, 'status');
  for (const f of ['totalAmount', 'status', 'createdBy']) assert(r.body.message.includes(`property ${f} should not exist`), f);
});
await test('TC-CREATE-API-12', 'Currency symbol is derived server-side', async () => {
  const got = [];
  for (const currency of ['USD', 'GBP', 'SGD', 'EUR']) got.push((await call('POST', '/invoices', { body: newInvoice({ currency }) })).body.currencySymbol);
  eq(got, ['US$', '£', 'S$', '€'], 'symbols');
});
await test('TC-CREATE-API-14', 'VND (0 minor units): whole-dong totals; decimals rejected', async () => {
  const ok = await call('POST', '/invoices', {
    body: newInvoice({ currency: 'VND', items: [{ name: 'Coffee', quantity: 3, rate: 33333 }], discount: 0 }),
  });
  eq([ok.status, ok.body.currencySymbol, ok.body.invoiceSubTotal, ok.body.totalTax, ok.body.totalAmount], [201, '₫', 99999, 10000, 109999], 'VND totals');
  const bad = await call('POST', '/invoices', {
    body: newInvoice({ currency: 'VND', items: [{ name: 'x', quantity: 1, rate: 1000.5 }], discount: 0.5 }),
  });
  eq(bad.status, 400, 'status');
  assert(bad.body.message.includes('items.0.rate must be a whole number for VND (no minor units)'), JSON.stringify(bad.body.message));
  assert(bad.body.message.includes('discount must be a whole number for VND (no minor units)'), 'discount message');
});
await test('TC-CREATE-API-13', 'Malformed JSON body → 400 in the standard error shape', async () => {
  const r = await call('POST', '/invoices', { body: '{bad json' });
  eq([r.status, Object.keys(r.body)], [400, ['statusCode', 'message', 'error']], 'shape');
});

// ---------------------------------------------------------------- rate limit (optional)
if (process.env.RUN_RATE_LIMIT) {
  console.log('Rate limiting');
  await test('TC-AUTH-16', 'Login is throttled after repeated attempts (429, readable message)', async () => {
    const responses = [];
    for (let i = 0; i < 12; i++) responses.push(await call('POST', '/auth/login', { auth: false, body: { email: EMAIL, password: 'x' } }));
    const throttled = responses.find((r) => r.status === 429);
    assert(throttled, `expected a 429, got ${responses.map((r) => r.status).join(',')}`);
    // Shown as-is on the login page, so it must read like a sentence, not a class name.
    assert(/^Too many sign-in attempts/.test(throttled.body.message), `unexpected message: ${JSON.stringify(throttled.body.message)}`);
    assert(throttled.headers.get('retry-after'), 'expected a Retry-After header');
  });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — FAILED: ${failed.map((f) => f.id).join(', ')}` : ''}\n`);
process.exit(failed.length ? 1 : 0);
