# Decision log

Why SimpleInvoice is built the way it is. Each entry says what we chose, what we rejected, why, and the cost we accepted. Details live in [`ARCHITECTURE.md`](ARCHITECTURE.md); defects referenced as D1–D15 are in [`TEST-CASES.md`](TEST-CASES.md).

Rule for new work: a new library or a non-obvious design choice gets an entry here in the same change.

**Contents:** [Stack](#stack) · [Data and money](#data-and-money) · [Business rules](#business-rules) · [Security](#security) · [API and UI](#api-and-ui) · [Testing and delivery](#testing-and-delivery) · [Considered and deferred](#considered-and-deferred)

---

## Stack

### DEC-01 One monorepo, no workspace tooling
- **Chose:** `backend/` and `frontend/` in one repository, each with its own `package.json` and lockfile.
- **Instead of:** two repositories, or npm workspaces / Nx / Turborepo.
- **Why:** reviewers clone once and run one `docker compose up`. Two apps with no shared code don't need a build orchestrator.
- **Cost:** no shared TypeScript types between API and UI; `frontend/src/api/types.ts` mirrors the DTOs by hand (Swagger is the reference).

### DEC-02 NestJS on the Fastify adapter
- **Chose:** NestJS 11 with `@nestjs/platform-fastify`.
- **Instead of:** the default Express adapter.
- **Why:** faster request handling and schema-friendly plugins, and it matches the target stack. Nest's modules, DI, guards and pipes stay the same.
- **Cost:** Express middleware can't be dropped in; we use the Fastify equivalents (`@fastify/helmet`, `@fastify/static`).

### DEC-03 Prisma as the data layer
- **Chose:** Prisma 6 (typed client + SQL migrations).
- **Instead of:** TypeORM (decorator entities, weaker typing of results) or Drizzle (closer to SQL, less familiar tooling).
- **Why:** fully typed queries, readable schema, reliable migrations, easy to explain.
- **Cost:** some database features can't be written in `schema.prisma`: the `lower(invoice_number)` unique index, trigram indexes and CHECK constraints live as hand-written SQL in the migration. Prisma's `contains` also doesn't escape `%` and `_`, which caused D6 (fixed with our own escaping).

### DEC-04 React Query for server state, Zustand for the session
- **Chose:** React Query for everything fetched from the API; a tiny Zustand store for the signed-in user and token.
- **Instead of:** Redux Toolkit for all state.
- **Why:** almost all state here is server data, and React Query gives caching, loading/error states and invalidation after create for free. The only client state is the session, which needs a few lines, not a Redux setup.
- **Cost:** two state tools to learn instead of one.

### DEC-05 MUI for components
- **Chose:** MUI 7 with our own theme tokens.
- **Instead of:** Tailwind + shadcn/ui, or hand-built components.
- **Why:** accessible, keyboard-ready inputs, selects, tables and dialogs out of the box, which matters more than visual novelty for a finance form.
- **Cost:** a larger bundle (split into its own cached chunk) and more effort to make it not look like default MUI (see [`UI-REVIEW.md`](UI-REVIEW.md)).

---

## Data and money

### DEC-06 Exact decimals for money
- **Chose:** `NUMERIC(18,2)` columns and `decimal.js` arithmetic, rounding half-up.
- **Instead of:** JavaScript numbers, or floats in the database.
- **Why:** binary floats can't represent most cents (`0.1 + 0.2 !== 0.3`). Appendix A's figures are reproduced exactly and checked by the seed.
- **Cost:** every calculation goes through the Decimal helpers in `invoices/domain/money.ts`.

### DEC-07 Amounts leave the API as JSON numbers, with caps
- **Chose:** JSON numbers in requests and responses, with quantity ≤ 100,000 and rate ≤ 100,000,000 per line.
- **Instead of:** decimal strings (`"2180.00"`) everywhere.
- **Why:** the spec's own examples use numbers, so spec-shaped requests work unchanged. A JSON number becomes a binary float in the client, exact for cents only up to about 90 trillion; the caps keep the largest total at 2×10^13, about 4.5× below that, so every amount returned today is exact (D8). Decided on 2026-09-30 after comparing with a strings-only design that rejects `"rate": 1000`.
- **Cost:** the caps are a real limit.
- **Revisit when:** caps rise, cross-invoice totals are returned, or currencies with 3+ decimals are added. The migration path (accept both, then version the response) is in ARCHITECTURE §10.1.

### DEC-08 Decimals per currency (ISO 4217 minor units)
- **Chose:** a currency table with symbol and minor units: 2 for AUD/USD/GBP/SGD/EUR, **0 for VND**.
- **Instead of:** assuming 2 decimals for every currency.
- **Why:** `1000.50 VND` is not a real amount; VND tax must round to whole dong (D13).
- **Cost:** validation, rounding and formatting all need the currency, on both sides.

### DEC-09 Store the calculated totals, guarded by the database
- **Chose:** persist subtotal, tax, discount, total, paid and balance, with CHECK constraints (e.g. `balance = total - paid`, amounts ≥ 0).
- **Instead of:** recalculating totals on every read.
- **Why:** an issued invoice's figures must not change if rules change later, and sorting by amount needs a real column.
- **Cost:** the stored numbers must be written correctly once; the CHECKs make a wrong write fail instead of drift.

### DEC-10 Customer details copied onto the invoice
- **Chose:** customer name, email, mobile and address as columns on `invoices`.
- **Instead of:** a separate `customers` table referenced by id.
- **Why:** an invoice is a legal document and must show the customer as they were when it was issued. It also keeps search a single-table query.
- **Cost:** no customer master data yet (roadmap).

### DEC-11 A `tax_rate` column
- **Chose:** store the tax percentage used.
- **Instead of:** only the tax amount, as in the reference model.
- **Why:** without it the totals can't be audited or recalculated.
- **Cost:** one column beyond the spec's model (documented).

### DEC-12 Invoice numbers unique in the database, case-insensitive
- **Chose:** a unique index on `lower(invoice_number)`; the unique-violation error becomes `409 Conflict`.
- **Instead of:** "check if it exists, then insert".
- **Why:** check-then-insert has a race: two requests can both pass the check. The index can't be raced (5 parallel creates → one 201, four 409s). `INV-1` and `inv-1` are the same number to a person.
- **Cost:** a hand-written index in the migration (DEC-03).

### DEC-13 Dates as plain `YYYY-MM-DD`
- **Chose:** `DATE` columns and date strings end to end; the UI never does `new Date('YYYY-MM-DD')`.
- **Instead of:** timestamps.
- **Why:** invoice and due dates are calendar days, not instants. Timestamps shift a day across time zones.
- **Cost:** small helpers for date maths instead of `Date`.

---

## Business rules

### DEC-14 Overdue is derived, never stored
- **Chose:** Overdue = not Paid and due date before today, worked out when reading. Each status filter is a SQL condition (Pending, for example, excludes overdue rows).
- **Instead of:** writing "Overdue" into the row with a nightly job.
- **Why:** the spec requires it, and a stored flag is wrong between job runs. SQL conditions keep counts and paging right: the four filters always add up to the total.
- **Cost:** the rule exists twice, in code for display and in SQL for filters; tests check they agree.

### DEC-15 "Today" in a business time zone
- **Chose:** `APP_TIMEZONE` (default `Asia/Singapore`) decides what "today" is.
- **Instead of:** the server clock's zone (UTC in containers).
- **Why:** an invoice due today must not flip to Overdue at 8 AM Singapore time because the server lives in UTC.
- **Cost:** one more setting.

### DEC-16 Totals only on the server
- **Chose:** the API calculates and stores every total; the form only shows an *estimate* while typing.
- **Instead of:** trusting totals sent by the client.
- **Why:** a client can send anything. The API rejects client-sent totals or status with 400.
- **Cost:** the estimate can differ from the stored total by rounding; the screen says so.

### DEC-17 Readings of unclear spec points
- **Discount is an amount**, not a percentage (the spec's formula subtracts it directly), and can't exceed subtotal + tax.
- **Blank tax means 10%**, applied by the server; the client omits the field instead of repeating the default.
- **A Draft past its due date shows as Overdue** (the rule taken literally); due today is not overdue.
- **Exactly one line item**, as specified; the schema and calculator already support many.
- All are listed in the README's Assumptions.

---

## Security

### DEC-18 One access token, kept in sessionStorage
- **Chose:** a 1-hour HS256 JWT, stored in `sessionStorage`, with no refresh token.
- **Instead of:** `localStorage` (survives closing the browser), or an httpOnly refresh cookie / backend-for-frontend.
- **Why:** the spec asks for a login that returns a JWT. `sessionStorage` is cleared when the tab closes. Refresh-token rotation adds endpoints, CSRF protection and multi-tab races, which is a lot of risk for a take-home.
- **Cost:** JavaScript can read the token, so an XSS bug would expose it (mitigated by a strict Content-Security-Policy), and users sign in again after an hour. Production path: BFF with httpOnly cookies (ARCHITECTURE §10.5).

### DEC-19 Protected by default
- **Chose:** a global JWT guard; routes opt out with `@Public()` (only login and health).
- **Instead of:** adding a guard to each controller.
- **Why:** forgetting a decorator on a new route then fails closed, not open.
- **Cost:** none worth mentioning.

### DEC-20 Login that leaks nothing
- **Chose:** the same error for an unknown email and a wrong password; a dummy bcrypt comparison for unknown users so timing matches; login rate-limited per IP (10 per minute) with a readable message (D14).
- **Instead of:** "user not found" errors, or per-account lockout.
- **Why:** stops account discovery and slows password guessing. Per-account lockout also lets anyone lock a known user out, and can trap a reviewer.
- **Cost:** the rate limit is in memory, so it's per instance; several instances would need Redis.

---

## API and UI

### DEC-21 Offset paging, capped page size
- **Chose:** `page` and `pageSize` (max 100) with a total count, in the spec's paging shape.
- **Instead of:** cursor (keyset) paging.
- **Why:** the spec asks for page numbers, and it's fast enough at this size.
- **Cost:** deep pages get slower at millions of rows; keyset paging is the plan (ARCHITECTURE §10.6).

### DEC-22 Search with ILIKE, trigram indexes and escaping
- **Chose:** case-insensitive `ILIKE` on invoice number and customer name, backed by `pg_trgm` GIN indexes; `%`, `_` and `\` are escaped first (D6).
- **Instead of:** full-text search or a search engine.
- **Why:** users search for fragments like `1023` or `harb`; trigram indexes make that fast without new infrastructure.
- **Cost:** no ranking or typo tolerance.

### DEC-23 The URL holds the list state
- **Chose:** search, filters, sort and page live in the query string.
- **Instead of:** component or global state.
- **Why:** refresh, back/forward and shared links all return to the same view.
- **Cost:** URL parameters need parsing and validation on the way in.

### DEC-24 Client validation mirrors the API; the API decides
- **Chose:** a Zod schema with the same rules as the DTOs, for instant feedback; server errors still shown (a duplicate number maps to the field).
- **Instead of:** server-only validation, or trusting the client.
- **Why:** fast feedback without giving up server authority.
- **Cost:** rules exist twice and must be changed together; tests cover both.

---

## Testing and delivery

### DEC-25 A real PostgreSQL in end-to-end tests
- **Chose:** Testcontainers starts a throwaway PostgreSQL; tests run against the real seed data and check properties that must always hold (filters add up to the total, each row appears on exactly one page).
- **Instead of:** mocking Prisma.
- **Why:** the risky parts are SQL: the status conditions, escaping, the case-insensitive index, CHECK constraints. Mocks would test none of them.
- **Cost:** the e2e suite needs Docker and takes about a minute.

### DEC-26 One browser smoke test, not a browser suite
- **Chose:** a single Playwright flow (sign in → create → search → detail → sign out), plus a black-box API script.
- **Instead of:** a large Playwright suite.
- **Why:** edge cases are cheaper and more stable in unit and component tests; the browser test proves the pieces connect.
- **Cost:** browser-only issues (layout, real date pickers) are checked by hand; the QA log records those runs.

### DEC-27 One command, local-demo defaults
- **Chose:** `docker compose up` works with no `.env`; the API container migrates and seeds on start. Seed dates are relative to today, so every status appears whenever it's reviewed; Appendix A is self-checked.
- **Instead of:** asking reviewers to create secrets, or running migrations as a separate job.
- **Why:** "Packaging" is judged on minimal setup.
- **Cost:** the defaults are demo-only (documented). In production, migrations run as a separate job before rollout (ARCHITECTURE §9).

### DEC-28 AI agents with rules and a checker
- **Chose:** `CLAUDE.md` project rules; `backend-engineer` and `frontend-engineer` subagents that each own one folder; a read-only `qa-reviewer` that runs every suite and reviews against the spec.
- **Instead of:** one general agent editing everything.
- **Why:** narrow scope and a fixed definition of done keep changes small and checked; the reviewer can't mark its own work (maker-checker).
- **Cost:** API contract changes need an explicit hand-off between agents.

---

## Considered and deferred

Deliberately not built for the assessment. Each has a trigger and a place in the roadmap.

| Idea | Why not now | When it's needed | Where |
|---|---|---|---|
| Money as decimal strings | Breaks the spec's number examples; exact today within the caps (DEC-07) | Higher caps, aggregates, 3+ decimal currencies | ARCHITECTURE §10.1 |
| `Idempotency-Key` on create | The unique invoice number already stops duplicates; a retry gets 409 instead of the original 201 | Clients that retry automatically, payment-like operations | §10.3 |
| Refresh tokens / BFF with httpOnly cookies | Endpoints, CSRF and multi-tab handling for little gain here (DEC-18) | Real users, longer sessions | §10.5 |
| Roles and permissions | The spec says every user sees all invoices | Multiple teams, approval limits, maker-checker | §10.5 |
| Append-only audit log | No edits or status changes exist yet to audit | Any edit, payment or status transition | §10.3 |
| Payments ledger | Only create and read are in scope; `totalPaid` is seed data | Recording payments | §10.2 |
| Keyset paging, Redis rate limits | One instance, small data | Many instances, millions of rows | §10.6 (keyset); README limitations (Redis) |
