# SimpleInvoice

A full-stack invoicing app: **sign in → invoice list (search, filter, sort, server-side paging) → invoice detail → create invoice**.

| | |
|---|---|
| **Frontend** | React 19 + TypeScript, Vite, MUI, React Query, Zustand, React Hook Form + Zod → [`frontend/README.md`](frontend/README.md) |
| **Backend** | NestJS 11 on **Fastify**, Prisma 6, class-validator, JWT, Swagger/OpenAPI → [`backend/README.md`](backend/README.md) |
| **Database** | PostgreSQL 16 |
| **Tests** | Jest (unit + e2e with Testcontainers), Vitest + React Testing Library, Playwright browser smoke test, black-box API script |
| **Packaging** | Docker Compose, multi-stage non-root images, GitHub Actions CI |

---

## Quick start (Docker)

Prerequisite: Docker with Compose v2 (Docker Desktop, OrbStack, …).

```bash
git clone <this-repo-url> simple-invoice
cd simple-invoice
docker compose up --build
```

The first build takes a few minutes. Compose starts PostgreSQL, then the API (which applies migrations and seeds demo data), then the web app. No `.env` file is needed: `docker-compose.yml` has local-demo defaults.

Open **http://localhost:8080** and sign in:

| Email | Password |
|---|---|
| `admin@simpleinvoice.dev` | `Password123!` |

| Service | URL | Host port |
|---|---|---|
| Web app | http://localhost:8080 | `8080` (`FRONTEND_PORT`) |
| REST API | http://localhost:3000 | `3000` (`BACKEND_PORT`) |
| Swagger UI | http://localhost:3000/api/docs | `3000` |
| PostgreSQL | `localhost:5432`, user / password / database all `simpleinvoice` | `5432` (`DB_PORT`) |

```bash
docker compose up --build -d     # run in the background
docker compose ps                # all three services should be "healthy"
docker compose logs -f backend   # follow API logs
docker compose down              # stop (data is kept)
docker compose down -v           # stop and delete the database (fresh start)
```

To change a setting, copy `.env.example` to `.env` in the repo root and edit it. The defaults are public local-demo values (see Known limitations), and every port is bound to `127.0.0.1`, so the stack is only reachable from this machine.

**Port already in use?** Pick another host port, e.g. `DB_PORT=5433 docker compose up --build`. The API URL is baked into the web build, so a different API port also needs `VITE_API_BASE_URL=http://localhost:<port>`; a different web port needs `CORS_ORIGIN=http://localhost:<port>`.

## Run without Docker

For development with hot reload, run each part on its own:

1. **Backend**: [`backend/README.md`](backend/README.md#run-locally): database, `.env`, migrate, seed, `npm run start:dev` → http://localhost:3000
2. **Frontend**: [`frontend/README.md`](frontend/README.md#run-locally): `npm install`, `npm run dev` → http://localhost:5173

Each README also covers that part's scripts, configuration, tests and code map.

---

## Repository

```
simple-invoice/
├── backend/          NestJS API          → backend/README.md
├── frontend/         React SPA           → frontend/README.md
├── docs/
│   ├── ARCHITECTURE.md   data model, API contract, business rules, security, AWS deployment, banking/payments roadmap
│   ├── DECISIONS.md      decision log: what we chose, what we rejected, why, and the cost
│   ├── TEST-CASES.md     acceptance cases (UI + API) and the QA log with defects D1–D15
│   └── UI-REVIEW.md      design decisions and accessibility/contrast audit
├── scripts/api-test.mjs  black-box API tests against a running stack
├── docker-compose.yml
├── CLAUDE.md         project rules for AI coding agents
└── .claude/agents/   backend-engineer, frontend-engineer and qa-reviewer subagents (Sonnet)
```

## Tests

| Suite | Count | Run |
|---|---|---|
| Backend unit | 72 | `cd backend && npm test` |
| Backend e2e (real PostgreSQL via Testcontainers) | 51 | `cd backend && npm run test:e2e` |
| Frontend | 57 | `cd frontend && npm test` |
| Black-box API (against the running stack) | 32 | `node scripts/api-test.mjs` |
| Browser smoke test (Playwright, against the running stack) | 1 flow | `cd frontend && npm run test:e2e` |

CI (`.github/workflows/ci.yml`) runs lint, typecheck and all tests on every push and pull request, then starts the full stack with `docker compose up` and runs the API script and the browser test against it. What each suite covers is in the backend and frontend READMEs; the acceptance cases and the QA log (15 defects found and fixed, most with a regression test) are in [`docs/TEST-CASES.md`](docs/TEST-CASES.md).

---

## Key design decisions

Details and trade-offs are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); every choice with the alternatives we rejected is in [`docs/DECISIONS.md`](docs/DECISIONS.md).

1. **Overdue is derived, never stored.** A pure function derives it for display. For filtering, each status becomes a SQL predicate (e.g. `Overdue` = `status <> 'Paid' AND due_date < today`, and `Pending` excludes overdue rows), so counts and pagination stay correct.
2. **"Today" uses a business timezone** (`APP_TIMEZONE`, default `Asia/Singapore`), not the server clock's timezone.
3. **Money uses decimals end to end:** `NUMERIC(18,2)` in Postgres and `decimal.js` in code. Tax is rounded half-up to the currency's minor units (2 dp, or whole dong for VND), and the Appendix A totals are reproduced exactly.
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
- **Amounts travel as JSON numbers.** Storage (`NUMERIC`) and maths (`decimal.js`) are exact decimals; the weak link is only the JSON number, which clients read as a binary float that holds cents exactly up to about 90 trillion. The caps keep the largest possible total at 2×10^13, about 4.5× below that, so every amount the API returns today is exact. Raising the caps, returning cross-invoice aggregates or adding currencies with more decimals would require the switch to decimal strings (`"2180.00"`); the migration path is in [`docs/ARCHITECTURE.md` §10.1](docs/ARCHITECTURE.md#101-money-representation).
- **No `Idempotency-Key`**: a retry after a network timeout gets `409` (the invoice number acts as the business key) rather than the original `201` response.
- **No events, webhooks or reconciliation**: no outbox, no inbox deduplication for PSP callbacks, and no matching against bank statements.
- **Authorization is authentication-only**: any valid token sees everything (per the spec); no ownership scope, approval limits or maker-checker.
- **Offset pagination**: fine at this scale; keyset pagination is the plan for large volumes.
- **Login rate limiting is in-memory per instance**. Multiple instances would need Redis or the WAF.
- **`VITE_API_BASE_URL` is baked in at build time**, so changing the API URL requires rebuilding the frontend image.
- **Demo secrets are in `docker-compose.yml`.** The fallback DB password and JWT secret are public local-demo values, so the stack runs with no setup. Anyone who reads this repository could sign tokens for a deployment that kept them. Secrets belong to the platform: in production they come from **AWS Secrets Manager**, injected by the ECS task definition and rotated there (HashiCorp Vault is the alternative for multi-cloud or on-premises). Details in [`docs/ARCHITECTURE.md` §9](docs/ARCHITECTURE.md#9-production-deployment-target-not-built-for-the-assessment). The Docker ports are bound to `127.0.0.1`, so the demo stack is not reachable from other machines.
- **Swagger UI is on by default** for reviewers. In production, set `SWAGGER_ENABLED=false` (or put the docs behind auth).
- Hand-written SQL in the migration (functional unique index, trigram indexes, CHECKs) isn't represented in `schema.prisma`. Future `prisma migrate dev` diffs must keep it.
- **Browser testing is one smoke flow** (Playwright: sign in → create → search → detail → sign out). Edge cases are covered by the backend e2e and frontend component tests; a larger browser suite (mobile viewport, error paths, visual regression) is the next step.

How each limitation would be solved in production (money as strings/minor units, payments ledger and double-entry journal, separated state dimensions, idempotency keys, outbox/inbox, reconciliation, maker-checker, OIDC + PKCE, PDPA) is in [`docs/ARCHITECTURE.md` §9–10](docs/ARCHITECTURE.md#10-roadmap--banking--payments-lens).

---

## How this was built (AI-assisted)

I built this with **Claude Code** as a pair programmer. I set the direction and made the decisions; the AI wrote most of the code and ran most of the checks. In practice:

1. **I kept the scope honest.** With a one-day deadline, the brief to myself was "show what the role needs, don't over-engineer". Production deployment and the banking roadmap are written down ([`ARCHITECTURE.md`](docs/ARCHITECTURE.md) §9–10) instead of half-built.
2. **Understanding before code.** We read the brief twice for gaps and contradictions (the mock stores `Overdue`; its paging shape differs from §2.3.1) and wrote the architecture before building. My readings of unclear points are in the Assumptions above.
3. **Nothing was "done" until it ran.** Each stage was checked for real: curl against a real database, unit tests, end-to-end tests on a real PostgreSQL, manual passes in Chrome on desktop and mobile, and finally a fresh clone from GitHub started with one `docker compose up`. These runs found 15 defects; each is logged in [`TEST-CASES.md`](docs/TEST-CASES.md) with its fix.
4. **I checked the output against domain knowledge, not only against the tests.** Reading about payment systems led to the VND fix (D13: no decimals in dong) and the roadmap. Money as strings was on the table too; I weighed it against the spec's number examples and chose exact numbers within proven limits, with a written trigger for changing it ([DEC-07](docs/DECISIONS.md#dec-07-amounts-leave-the-api-as-json-numbers-with-caps)).
5. **Every choice is written down.** [`DECISIONS.md`](docs/DECISIONS.md) lists what I chose, what I rejected and the cost, including what I deliberately did not build.
6. **Guardrails for the next change.** [`CLAUDE.md`](CLAUDE.md) holds the project rules (decimal money, date strings, Overdue never stored, totals only on the server). [`.claude/agents/`](.claude/agents) defines a `backend-engineer` and a `frontend-engineer` (Sonnet), each owning one folder with a fixed definition of done, and a read-only `qa-reviewer` that runs every suite and reviews against the spec. It has no edit tools, so it can report but never fix: the same maker-checker idea banks use for payments.
