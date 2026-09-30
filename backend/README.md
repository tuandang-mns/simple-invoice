# SimpleInvoice API (backend)

REST API for SimpleInvoice: authentication, invoice list/detail and invoice creation.

**Stack:** NestJS 11 on Fastify · Prisma 6 · PostgreSQL 16 · class-validator · JWT · Swagger/OpenAPI · decimal.js · Jest + Testcontainers

← Back to the [project README](../README.md) · Design details: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

---

## Run locally

Prerequisites: **Node.js 22+** (`nvm use` reads the repo's `.nvmrc`) and a **PostgreSQL 14+** database.

**1. Start a database.** The easiest way is the DB container from the repo root:

```bash
docker compose up -d db
```

Or use your own PostgreSQL (`createdb simpleinvoice`) and set `DATABASE_URL` in step 2 to match it.

**2. Configure, install, migrate, seed and start** (from `backend/`):

```bash
cp .env.example .env    # the example values match the DB container from step 1
npm install             # also generates the Prisma client
npm run db:migrate      # tables, constraints and indexes
npm run seed            # demo user + 41 invoices
npm run start:dev       # http://localhost:3000, watch mode
```

**3. Check it:**

| | URL |
|---|---|
| Health | http://localhost:3000/health → `{"status":"ok"}` |
| Swagger UI | http://localhost:3000/api/docs |

Demo login: `admin@simpleinvoice.dev` / `Password123!` (set by `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`).

To run the web app against it, see [`frontend/README.md`](../frontend/README.md).

---

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Start in watch mode |
| `npm run build` / `npm run start:prod` | Compile to `dist/` / run the compiled app |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |
| `npm run seed` | Idempotent: upserts the demo user; inserts invoices only if the table is empty |
| `npm run seed:reset` | Delete all invoices and seed again |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests against a throwaway PostgreSQL (needs Docker running) |
| `npm run test:cov` | Unit tests with coverage |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |

---

## Environment variables

The API validates its environment on start-up ([`env.validation.ts`](src/config/env.validation.ts)) and refuses to run if a value is missing or invalid, so a half-configured container never reports healthy.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | none (required) | `postgresql://user:pass@host:port/db?schema=public` |
| `JWT_SECRET` | none (required) | at least 32 characters |
| `JWT_EXPIRES_IN` | `3600` | token lifetime in seconds |
| `PORT` | `3000` | |
| `CORS_ORIGIN` | `http://localhost:5173` | comma-separated list of allowed web origins |
| `APP_TIMEZONE` | `Asia/Singapore` | the business "today" used to derive Overdue |
| `LOGIN_RATE_LIMIT` / `LOGIN_RATE_TTL` | `10` / `60` | login attempts per window (seconds) |
| `SWAGGER_ENABLED` | `true` | set `false` to hide `/api/docs` |
| `COOKIE_SECURE` | `true` | `Secure` flag on the session cookie (browsers treat `http://localhost` as secure); `false` only for a non-localhost HTTP host |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, or `silent` |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_FULLNAME` | none / none / `Demo Admin` | used by the seed only |

`npm run seed` and the API both read `backend/.env`; variables already set in the shell win.

---

## Seed data

The seed loads the **Appendix A** invoice plus **40 generated invoices** with a mix of statuses, currencies (including VND) and customers. Dates are generated **relative to the day you run it**, so Draft, Pending, Paid and (derived) Overdue all appear whenever the app is reviewed.

It also **checks itself**: it recomputes Appendix A with the production calculator, and if the result doesn't match the published figures (2180.00 total, 728.66 balance) it fails instead of writing different numbers.

In Docker the seed runs on every container start (it is idempotent). To re-seed a running stack:

```bash
docker compose exec backend node dist/database/seed/seed.js --reset
```

---

## API

Interactive docs are at **`/api/docs`**. Every route except login and health requires a valid session: the HttpOnly `si_session` cookie (the web app) or `Authorization: Bearer <token>` (API clients). Sign-out revokes the session on the server.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Email + password → `{ accessToken, tokenType, expiresIn, user }`, and sets the HttpOnly session cookie |
| POST | `/auth/logout` | Revokes the session on the server and clears the cookie → `204` |
| GET | `/auth/me` | Current user profile |
| GET | `/invoices` | `page`, `pageSize` (≤100), `sortBy` (`invoiceDate`/`dueDate`/`totalAmount`), `ordering` (`ASC`/`DESC`), `status` (`Draft`/`Pending`/`Paid`/`Overdue`), `keyword`, `fromDate`, `toDate` → `{ data, paging: { page, pageSize, total } }` |
| GET | `/invoices/:id` | Invoice with customer and line items |
| POST | `/invoices` | Create (status always `Draft`, totals calculated server-side) → `201`; duplicate number → `409` |
| GET | `/health` | Readiness probe (checks the DB) |

Errors always look like `{ "statusCode": 400, "message": [...], "error": "Bad Request" }`.

Quick try with curl:

```bash
curl -s -X POST http://localhost:3000/auth/login -H 'content-type: application/json' -d '{"email":"admin@simpleinvoice.dev","password":"Password123!"}'
```

---

## Tests

| Suite | Count | Covers |
|---|---|---|
| Unit (`npm test`) | 78 | Sessions: active / revoked / expired / other user's; logout revokes only its own session. Appendix A totals reproduced exactly; half-up rounding per currency (VND whole dong); no float drift; Overdue edge cases (due today, Paid, Draft); DTO rules (caps, dates, due ≥ invoice date); query builder (status → SQL, LIKE escaping); auth; error filter; seed covers every status whatever day it runs |
| E2E (`npm run test:e2e`) | 58 | HttpOnly/Secure/SameSite cookie; cookie-only auth; CSRF Origin check (writes and login); sign-out kills every copy of the token; credentialed CORS only for our origin. Login → create → list → detail on a real PostgreSQL. The four status filters sum to the total; every page walked returns each invoice once; sort order per field; inclusive date bounds; list = detail; forged / expired / `alg:none` tokens rejected; same error for unknown email and wrong password; DB-level duplicate → 409 |

The e2e suite starts its own PostgreSQL through Testcontainers, so it needs Docker but no running DB or seed.

Black-box acceptance tests against a running stack (from the repo root):

```bash
node scripts/api-test.mjs      # 32 cases; RUN_RATE_LIMIT=1 adds the throttling case
```

---

## Code map

```
backend/
├── prisma/            schema + SQL migrations (CHECK constraints, case-insensitive unique, trigram indexes)
├── src/
│   ├── auth/          login, /me, global JWT guard (secure by default, @Public() to opt out)
│   ├── invoices/
│   │   ├── domain/    pure business rules: totals calculator, money, Overdue derivation, currencies
│   │   ├── dto/       validation + Swagger contracts
│   │   └── …          controller → service → Prisma; list query builder
│   ├── common/        exception filter, validators, date utils
│   ├── config/        env validation (fails fast)
│   ├── database/      Prisma service + seed/
│   ├── health/        /health
│   └── users/
├── test/              e2e specs + Testcontainers harness
├── Dockerfile         multi-stage, non-root runtime
└── docker-entrypoint.sh   migrate → seed → start
```

**Rules to keep when changing code** (also in [`CLAUDE.md`](../CLAUDE.md)):

- Business rules live as pure functions in `src/invoices/domain/`; change them there and add unit tests.
- Money is `Decimal` + `NUMERIC(18,2)`, never JS float arithmetic for stored amounts.
- Dates are `YYYY-MM-DD` strings end to end.
- `Overdue` is derived at read time and never written to the database.
- Schema changes need a new Prisma migration. Hand-written SQL (CHECKs, functional and trigram indexes) lives in migrations and isn't represented in `schema.prisma`, so future `prisma migrate dev` diffs must keep it.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `JWT_SECRET must be at least 32 characters` (or another env error) on start | Compare `.env` with `.env.example`. |
| `SEED_USER_EMAIL is required to seed the demo user` | Run the seed from `backend/` so it finds `.env`, or export the variable. |
| `Can't reach database server` | Is the DB running? If you started it with `DB_PORT=5433`, change the port in `DATABASE_URL` too. |
| Login returns `429 Too Many Requests` | Login is rate-limited (10 per minute by default). Wait a minute. |
| `npm run test:e2e` fails to start | Docker must be running for Testcontainers. |
