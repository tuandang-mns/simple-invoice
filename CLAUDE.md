# SimpleInvoice — guide for AI coding agents

Monorepo: `backend/` (NestJS 11 + Fastify + Prisma 6 + PostgreSQL) and `frontend/` (React 19 + Vite + MUI).
Design decisions live in `docs/ARCHITECTURE.md` — read it before changing behaviour.

## Commands
- Backend: `npm run lint`, `npm run typecheck`, `npm test` (unit), `npm run test:e2e` (needs Docker), `npm run seed`
- Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (Playwright, needs the stack running)
- Full stack: `docker compose up --build`

## Rules
- Business rules are pure functions in `backend/src/invoices/domain/` — change them there and add unit tests.
- Money is `Decimal` (decimal.js) and `NUMERIC(18,2)` — never JS float arithmetic for persisted amounts.
- Dates are `YYYY-MM-DD` strings end-to-end; never `new Date('YYYY-MM-DD')` in UI code.
- `Overdue` is derived at read time and must never be written to the database.
- Totals are computed by the backend only; the frontend may show an estimate, never send totals.
- Every route is JWT-protected by default; opt out explicitly with `@Public()`.
- Errors always use `{ statusCode, message, error }` (global exception filter).
- Schema changes need a new Prisma migration; hand-written SQL (CHECKs, functional/trigram indexes) lives in migrations.
- Never commit secrets; config comes from env vars validated in `backend/src/config/env.validation.ts`.

## Agents
Project subagents live in `.claude/agents/` and run on Sonnet:
- `backend-engineer`: owns `backend/` (API, DTOs, domain rules, Prisma, seed, backend tests).
- `frontend-engineer`: owns `frontend/` (screens, forms, hooks, styling, frontend tests).
- `qa-reviewer`: read-only checker (no edit tools). Runs every suite and reviews changes against the spec and these rules; reports findings to the owning agent.
Each engineer stays inside its folder. A change to the API contract goes backend first; the backend agent reports the contract change and the frontend agent follows it. Run `qa-reviewer` after a change and before committing.
