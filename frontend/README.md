# SimpleInvoice web app (frontend)

React single-page app for SimpleInvoice: sign in, browse and filter invoices, view one, create one.

**Stack:** React 19 + TypeScript · Vite 7 · MUI 7 · React Query · Zustand · React Hook Form + Zod · notistack · Vitest + React Testing Library

← Back to the [project README](../README.md) · UI decisions and accessibility audit: [`docs/UI-REVIEW.md`](../docs/UI-REVIEW.md)

---

## Screens

| Route | Screen |
|---|---|
| `/login` | Sign in (returns you to the page you originally asked for) |
| `/invoices` | List: keyword search, status filter, invoice-date range, sort, server-side paging; table on desktop, cards on mobile |
| `/invoices/new` | Create invoice, with client validation and an estimated total |
| `/invoices/:id` | Invoice detail with customer, line item and totals |

Every route except `/login` requires a session.

---

## Run locally

Prerequisites: **Node.js 22+** and the **API running** on http://localhost:3000 (see [`backend/README.md`](../backend/README.md), or run `docker compose up -d backend` from the repo root).

```bash
cp .env.example .env.local   # optional: VITE_API_BASE_URL defaults to http://localhost:3000
npm install
npm run dev                  # http://localhost:5173
```

Sign in with `admin@simpleinvoice.dev` / `Password123!`.

The API allows `http://localhost:5173` by default (`CORS_ORIGIN`). If you serve the app from another origin, add it there.

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000` | Baked in at build time; changing it means rebuilding (and a new Docker image) |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` / `npm run test:watch` | Vitest, once / in watch mode |
| `npm run test:cov` | Tests with coverage |
| `npm run test:e2e` | Playwright browser smoke test against a running stack (see below) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |

In Docker, the build is served by nginx on port 8080 with a strict Content-Security-Policy and security headers (`nginx.conf`, `security-headers.conf`).

---

## How it works

- **Server state lives in React Query; session state in Zustand.** The session store is persisted to `sessionStorage`, so it is cleared when the tab closes.
- **The URL is the source of truth for the list.** Search, filters, sort and page are query parameters, so refresh, back/forward and shared links all land on the same view. Search is debounced.
- **The HTTP client** (`src/api/client.ts`) adds the bearer token, and on any `401` signs the user out and sends them to login with a "session expired" notice.
- **Validation mirrors the API** (Zod schema in `invoice-form.schema.ts`): required fields, due date ≥ invoice date, up to 2 decimals (whole numbers for VND), quantity and rate caps, discount not larger than subtotal + tax. The API still validates everything.
- **Totals are never sent.** The form shows an *estimated* total while typing; the stored figures come from the server. A back-dated invoice is saved as Draft but the toast shows the status the server returns (e.g. Overdue).
- **A duplicate invoice number (`409`)** is shown on the invoice-number field rather than as a generic error.
- **Money formatting** follows each currency's decimals (`₫47,304,527` for VND, `AU$2,180.00` for AUD); dates stay `YYYY-MM-DD` strings and are never parsed with `new Date('YYYY-MM-DD')`.
- **Accessibility:** skip link, `<main>` landmark, keyboard-reachable rows, visible focus, reduced-motion support, WCAG AA contrast. One navy accent; status chips are tints.

---

## Tests

**Component tests:** 56 Vitest + React Testing Library tests:

| Area | Covers |
|---|---|
| Login and route guard | sign-in flow, redirect when unauthenticated or expired, deep link back after login |
| List | debounced search, URL-driven filters, sort, past-the-end page, long values truncated |
| Detail | rendering, currency decimals (VND) |
| Create form | client validation, every 2-decimal price 0.01–999.99 accepted, blank tax → server default, `409` → field error |
| HTTP client and store | bearer header, `401` → logout, query serialisation, session persistence |
| Formatting | money per currency, date helpers |

**Browser smoke test:** one Playwright flow in [`e2e/invoice-flow.e2e.ts`](e2e/invoice-flow.e2e.ts). It signs in through the redirect from a protected page, creates an invoice, finds it with the search box, checks the server-calculated totals on the detail page, and signs out. It runs against a running stack (web app, API, seeded DB):

```bash
docker compose up --build -d                   # from the repo root
npx playwright install chromium                # once, downloads the test browser
npm run test:e2e                               # BASE_URL defaults to http://localhost:8080
```

To use your installed Chrome instead of downloading Chromium: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. To test the Vite dev server: `BASE_URL=http://localhost:5173 npm run test:e2e`. CI runs it on every push against the Docker stack.

---

## Code map

```
frontend/src/
├── api/          axios client, typed endpoints, shared types and currency decimals
├── stores/       Zustand session store (sessionStorage)
├── features/
│   ├── auth/     LoginPage, RequireAuth route guard, login schema
│   └── invoices/ list, detail and create pages; form schema; React Query hooks; URL params hook
│       └── components/   table, mobile cards, filters, date field, status chip
├── components/   app layout (header, skip link), 404 page
├── lib/          formatting and debounce helpers
├── theme.ts      design tokens + MUI theme
└── App.tsx       routes
```
