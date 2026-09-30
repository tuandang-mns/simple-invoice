# SimpleInvoice

A full-stack invoicing app: **login → invoice list (search / filter / sort / server-side paging) → invoice detail → create invoice**.

| | |
|---|---|
| **Frontend** | React 19 + TypeScript, Vite, MUI, React Query, Zustand, React Hook Form + Zod |
| **Backend** | NestJS 11 on **Fastify**, Prisma 6, class-validator, JWT, Swagger/OpenAPI |
| **Database** | PostgreSQL 16 |
| **Tests** | Jest (unit + e2e with Testcontainers), Vitest + React Testing Library |
| **Packaging** | Docker Compose, multi-stage non-root images, GitHub Actions CI |

📐 **Architecture & design decisions:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). It covers the data model, API contract, business rules, security, production deployment and a banking/payments roadmap. UI decisions and the accessibility/contrast audit are in [`docs/UI-REVIEW.md`](docs/UI-REVIEW.md).

---

## Getting started

There are two ways to run the app:

| | Option A: Docker | Option B: Local |
|---|---|---|
| **Best for** | Reviewing the app, one command | Developing, hot reload |
| **You need** | Docker with Compose v2 (Docker Desktop, OrbStack, …) | Node.js 22+, PostgreSQL 14+ (or Docker for the DB only) |
| **Web app** | http://localhost:8080 | http://localhost:5173 |
| **API / Swagger** | http://localhost:3000 · [`/api/docs`](http://localhost:3000/api/docs) | same |

### 🔑 Demo login (both options)

| Email | Password |
|---|---|
| `admin@simpleinvoice.dev` | `Password123!` |

The seed script creates these demo credentials. Change them with `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`.

```bash
git clone <this-repo-url> simple-invoice
cd simple-invoice
```

---

### Option A: Run with Docker (recommended)

```bash
docker compose up --build
```

The first build takes a few minutes. Compose then:

1. starts **PostgreSQL 16** and waits until it is healthy;
2. starts the **API**, which applies migrations, seeds the demo user and 41 invoices (only if the table is empty), then listens on port 3000;
3. serves the **web app** from nginx on port 8080 once the API is healthy.

Open **http://localhost:8080** and sign in with the demo login. No `.env` file is needed, because `docker-compose.yml` has local-demo defaults.

| Service | URL | Host port |
|---|---|---|
| Web app | http://localhost:8080 | `8080` (`FRONTEND_PORT`) |
| REST API | http://localhost:3000 | `3000` (`BACKEND_PORT`) |
| Swagger UI | http://localhost:3000/api/docs | `3000` |
| Health check | http://localhost:3000/health → `{"status":"ok"}` | `3000` |
| PostgreSQL | `localhost:5432`, user / password / database all `simpleinvoice` | `5432` (`DB_PORT`) |

Useful commands:

```bash
docker compose up --build -d          # run in the background
docker compose ps                     # all three services should be "healthy"
docker compose logs -f backend        # follow API logs
docker compose exec backend node dist/database/seed/seed.js --reset   # wipe invoices and re-seed
docker compose down                   # stop (data is kept in the db-data volume)
docker compose down -v                # stop and delete the database volume (fresh start)
```

To change a setting, copy `.env.example` to `.env` in the repo root and edit it. Compose reads it automatically. The defaults are for local demo only; never reuse them in a real environment.

---

### Option B: Run locally (without Docker for the app)

Prerequisites: **Node.js 22+** (`nvm use` picks the version from `.nvmrc`) and a **PostgreSQL 14+** database.

**1. Start a database.** The easiest way is to run only the DB container from the compose file:

```bash
docker compose up -d db
```

Or use your own PostgreSQL:

```bash
createdb simpleinvoice
```

Then set `DATABASE_URL` in step 2 to match your user, password and port.

**2. Start the backend** (http://localhost:3000, Swagger at `/api/docs`):

```bash
cd backend
cp .env.example .env    # the example values match the DB container from step 1
npm install             # also generates the Prisma client
npm run db:migrate      # create the tables, constraints and indexes
npm run seed            # demo user + 41 invoices
npm run start:dev       # watch mode
```

Check it with `curl http://localhost:3000/health`, which should return `{"status":"ok"}`.

**3. Start the frontend** (http://localhost:5173) in a second terminal:

```bash
cd frontend
cp .env.example .env.local   # optional: VITE_API_BASE_URL defaults to http://localhost:3000
npm install
npm run dev
```

Open **http://localhost:5173** and sign in with the demo login.

#### Environment variables

The API validates its environment on start-up and refuses to run if a value is missing or invalid (for example, a `JWT_SECRET` shorter than 32 characters).

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | none (required) | `postgresql://user:pass@host:port/db?schema=public` |
| `JWT_SECRET` | none (required) | at least 32 characters |
| `JWT_EXPIRES_IN` | `3600` | token lifetime in seconds |
| `PORT` | `3000` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | comma-separated list of allowed web origins |
| `APP_TIMEZONE` | `Asia/Singapore` | the business "today" used to derive Overdue |
| `LOGIN_RATE_LIMIT` / `LOGIN_RATE_TTL` | `10` / `60` | login attempts per window (seconds) |
| `SWAGGER_ENABLED` | `true` | set `false` to hide `/api/docs` |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, or `silent` |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | none | required by `npm run seed` |
| `VITE_API_BASE_URL` (frontend) | `http://localhost:3000` | baked in at build time |

---

### Troubleshooting

| Symptom | Fix |
|---|---|
| `port is already allocated` on 5432, 3000 or 8080 | Pick another host port: `DB_PORT=5433 docker compose up --build`. For local runs, also change the port in `DATABASE_URL` in `backend/.env`. |
| Changed `BACKEND_PORT` and the web app can't reach the API | The API URL is baked into the frontend build: `BACKEND_PORT=3001 VITE_API_BASE_URL=http://localhost:3001 docker compose up --build`. |
| Changed `FRONTEND_PORT` and the browser shows a CORS error | Allow the new origin: `FRONTEND_PORT=8081 CORS_ORIGIN=http://localhost:8081 docker compose up --build`. |
| API exits with `JWT_SECRET must be at least 32 characters` (or similar) | A required env var is missing or invalid. Compare `backend/.env` with `.env.example`. |
| `SEED_USER_EMAIL is required to seed the demo user` | Run the seed from the `backend/` folder so it finds `backend/.env`, or export the variable. |
| Login returns `429 Too Many Requests` | Login is rate-limited (10 per minute by default). Wait a minute. |
| Old or odd data after pulling changes | Reset the database: `docker compose down -v && docker compose up --build`, or locally `npm run seed:reset`. |
| `npm run test:e2e` fails to start | The e2e tests start a throwaway PostgreSQL through Testcontainers, so Docker must be running. |

---

### Seeding

```bash
cd backend
npm run seed        # idempotent: upserts the demo user; inserts invoices only if the table is empty
npm run seed:reset  # deletes all invoices and seeds again
```

In Docker the seed runs automatically on start. To re-seed a running stack: `docker compose exec backend node dist/database/seed/seed.js --reset`.

The seed loads the **Appendix A** invoice plus **40 generated invoices** with a mix of statuses, currencies (including VND) and customers. Their dates are generated **relative to the day you run the seed**, so Draft, Pending, Paid and (derived) Overdue all show up whenever the app is reviewed.

The seed also **checks itself**. It recomputes the Appendix A invoice with the production calculator, and if the result doesn't match the published figures (2180.00 total, 728.66 balance), it fails instead of writing different numbers.

---

## Tests

```bash
# Backend
cd backend
npm test              # unit tests: totals, Overdue derivation, due-date rule, unique number → 409, query builder, auth, error filter, seed data
npm run test:e2e      # e2e on a throwaway PostgreSQL via Testcontainers (requires Docker; no running DB or seed needed)
npm run test:cov      # unit tests with coverage

# Frontend
cd frontend
npm test              # login flow, route guard, list (search/filter/sort/paging), detail, create form
```

| Suite | Count | Highlights |
|---|---|---|
| Backend unit | 72 | Appendix A totals reproduced exactly; half-up rounding; no float drift; Overdue edge cases (due today, Paid, Draft); seed covers every status whatever day it runs |
| Backend e2e | 51 | **Workflow:** login → create → appears in list → detail. **List properties on the real seed data:** the four status filters sum to the total; walking every page returns each invoice exactly once; sort order for each field/direction; inclusive date bounds; combined queries; list = detail. **Auth:** forged / expired / `alg:none` tokens rejected; identical errors for unknown email vs wrong password. **Also:** DB-level duplicate → 409; client-sent totals/status rejected |
| Frontend | 56 | every 2-decimal price 0.01–999.99 accepted; client validation; redirect when unauthenticated/expired; debounced search; URL-driven filters; past-the-end page; blank tax → server default; 409 → field error; HTTP client (bearer header, 401 → logout, query serialisation) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, all tests and the Docker builds on every push/PR.

### Acceptance tests against the running stack

```bash
docker compose up --build -d
node scripts/api-test.mjs      # 32 black-box API cases (add RUN_RATE_LIMIT=1 for the throttling case)
```

[`docs/TEST-CASES.md`](docs/TEST-CASES.md) lists every acceptance case with its steps and expected result: auth, list, detail, create and packaging, both UI and API. It also records the latest full QA run in Chrome, including the 13 defects (D1–D13) the QA passes found and fixed, most with a regression test.

---

## API overview

Full interactive docs are at **`/api/docs`**. All routes except login and health require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Email + password → `{ accessToken, tokenType, expiresIn, user }` |
| GET | `/auth/me` | Current user profile |
| GET | `/invoices` | `page`, `pageSize` (≤100), `sortBy` (`invoiceDate`/`dueDate`/`totalAmount`), `ordering` (`ASC`/`DESC`), `status` (`Draft`/`Pending`/`Paid`/`Overdue`), `keyword`, `fromDate`, `toDate` → `{ data, paging: { page, pageSize, total } }` |
| GET | `/invoices/:id` | Invoice with customer and line items |
| POST | `/invoices` | Create (status always `Draft`, totals calculated server-side) → `201`; duplicate number → `409` |
| GET | `/health` | Readiness probe (checks the DB) |

Errors always look like `{ "statusCode": 400, "message": [...], "error": "Bad Request" }`.

---

## Architecture in brief

```
simple-invoice/
├── backend/                 NestJS API (modular monolith)
│   ├── prisma/              schema + SQL migrations (CHECK constraints, case-insensitive unique, trigram indexes)
│   └── src/
│       ├── auth/            login, /me, global JWT guard (secure by default, @Public() to opt out)
│       ├── invoices/
│       │   ├── domain/      pure business rules: totals calculator, Overdue derivation, currencies
│       │   ├── dto/         validation + Swagger contracts
│       │   └── …            controller → service → Prisma; list query builder
│       ├── common/          exception filter, validators, date utils
│       ├── config/          env validation (fails fast on bad config)
│       └── database/        Prisma service + seed/
├── frontend/                React SPA
│   └── src/
│       ├── api/             axios client (bearer token, 401 → logout), typed endpoints
│       ├── stores/          Zustand session store (sessionStorage)
│       └── features/        auth/ (login, route guard) · invoices/ (list, detail, create)
├── docs/ARCHITECTURE.md
└── docker-compose.yml
```

**Repository layout:** a monorepo, so reviewers clone, run and read one repository.

---

## Key design decisions

Details and trade-offs are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

1. **Overdue is derived, never stored.** A pure function derives it for display. For filtering, each status becomes a SQL predicate (e.g. `Overdue` = `status <> 'Paid' AND due_date < today`, and `Pending` excludes overdue rows), so counts and pagination stay correct.
2. **"Today" uses a business timezone** (`APP_TIMEZONE`, default `Asia/Singapore`), not the server clock's timezone.
3. **Money uses decimals end to end:** `NUMERIC(18,2)` in Postgres and `decimal.js` in code. Tax is rounded half-up to 2 dp, and the Appendix A totals are reproduced exactly.
4. **Invoice-number uniqueness is enforced by the database** (unique index on `lower(invoice_number)`). A unique violation becomes **409**, which is race-safe, unlike check-then-insert.
5. **Customer details are stored on the invoice row.** An issued invoice keeps a snapshot of the customer as they were at issue time.
6. **A `tax_rate` column was added** (it isn't in the reference model) so the applied tax % can be audited.
7. **Defence in depth:** the rules live in the DTO validation, the domain/service layer and DB CHECK constraints.
8. **The URL is the source of truth for list state** in the UI, so refresh, back and shared links all work.

## Assumptions

- `fromDate`/`toDate` filter on **invoiceDate** (inclusive). The default sort is newest-created first.
- **Discount is an absolute amount** (the spec's formula subtracts it directly) and cannot exceed subtotal + tax.
- A **Draft** past its due date is shown as **Overdue**, following the rule literally. A due date **equal to today is not overdue**.
- All authenticated users see all invoices (the spec says "all available invoices within the system").
- Invoice numbers are unique **case-insensitively** and trimmed.
- Per line, **quantity ≤ 100,000** and **rate ≤ 100,000,000**. Amounts travel as JSON numbers, which hold cents exactly only below about 90 trillion; these caps keep every possible total well inside that. Business dates must fall in **1900–2999**.
- Search treats `%` and `_` literally (they're escaped before the SQL `ILIKE`).
- Supported currencies: AUD, USD, GBP, SGD, EUR, VND. The symbols are server-side (the mock uses `AU$`). Amounts follow each currency's **ISO 4217 minor units**: 2 decimals, but **0 for VND**, so `1000.50 VND` is rejected and VND tax rounds to whole dong.
- Appendix A: the record is seeded as `Pending`, because `Overdue` must never be stored. Non-model fields (`type`, `invoiceGrossTotal`) are omitted. Paging uses the §2.3.1 shape.

## Known limitations

- **Only create and read**: there's no edit, status transition or payment recording. `totalPaid` is a plain number (only the seed sets it), not an append-only payments ledger with double-entry postings and reversals.
- **One status field**: document, collection and settlement states aren't separated, and there's no "payment accepted ≠ final" distinction yet (no payments are collected).
- **Exactly one line item per invoice**, per the spec. The schema and calculator already support many.
- **JWT is kept in `sessionStorage`**. It's cleared on tab close and the frontend has a strict CSP, but this is still readable by JavaScript if an XSS bug existed. The production path is a BFF with httpOnly cookies.
- **No refresh tokens**: the user signs in again when the token expires (default 1 h).
- **Sorting by amount across currencies** compares raw numbers (no FX conversion).
- **Amounts are JSON numbers**, exact only up to the documented caps. Production would send strings and store integer minor units.
- **No `Idempotency-Key`**: a retry after a network timeout gets `409` (the invoice number acts as the business key) rather than the original `201` response.
- **No events, webhooks or reconciliation**: no outbox, no inbox deduplication for PSP callbacks, and no matching against bank statements.
- **Authorization is authentication-only**: any valid token sees everything (per the spec); no ownership scope, approval limits or maker-checker.
- **Offset pagination**: fine at this scale; keyset pagination is the plan for large volumes.
- **Login rate limiting is in-memory per instance**. Multiple instances would need Redis or the WAF.
- **`VITE_API_BASE_URL` is baked in at build time**, so changing the API URL requires rebuilding the frontend image.
- **Swagger UI is on by default** for reviewers. In production, set `SWAGGER_ENABLED=false` (or put the docs behind auth).
- Hand-written SQL in the migration (functional unique index, trigram indexes, CHECKs) isn't represented in `schema.prisma`. Future `prisma migrate dev` diffs must keep it.
- No browser E2E suite (Playwright) yet. Flows are covered by the backend e2e tests and frontend component tests.

How each limitation would be solved in production (money as strings/minor units, payments ledger and double-entry journal, separated state dimensions, idempotency keys, outbox/inbox, reconciliation, maker-checker, OIDC + PKCE, PDPA) is in [`docs/ARCHITECTURE.md` §9–10](docs/ARCHITECTURE.md#10-roadmap--banking--payments-lens).

---

## How this was built (AI-assisted)

The project was built with **Claude Code** as a pair programmer, with me reviewing and steering:

1. **Requirements analysis first.** The spec was analysed twice for ambiguities and internal inconsistencies (e.g. the mock stores `Overdue`, and the mock's paging shape differs from §2.3.1). The decisions went into the Assumptions section above.
2. **Architecture before code.** `docs/ARCHITECTURE.md` (data model, API contract, the status→SQL mapping) was written and reviewed first.
3. **Incremental build with verification at each step.** Backend, then smoke tests with curl against a real DB, then unit + e2e tests, then frontend, then browser checks on desktop and mobile viewports, then `docker compose up` from an empty volume.
4. **Guardrails for agents:** [`CLAUDE.md`](CLAUDE.md) records the project rules (money as decimals, date strings, Overdue never stored, backend-only totals) so future AI-assisted changes keep them.
