# SimpleInvoice — Test Cases & QA Run

Manual and scripted acceptance tests for every feature in the spec (§2.1–§2.4), with the result of the latest run.

## Latest run

| | |
|---|---|
| **Date** | 2026-09-29 |
| **Environment** | Full stack in Docker (OrbStack): `db` (postgres:16-alpine), `backend` (NestJS), `frontend` (nginx), started from an empty volume with `docker compose up --build` |
| **Data** | Fresh seed: Appendix A + 40 generated invoices (10 Draft / 8 Pending / 13 Paid / 10 Overdue). Test "today" = 2026-09-29 (Asia/Singapore) |
| **UI tested in** | Google Chrome (Claude in Chrome) at 1512 px wide, plus the built-in browser with 375×812 mobile emulation |
| **API tested with** | [`scripts/api-test.mjs`](../scripts/api-test.mjs) (repeatable, no dependencies) |
| **Result** | ✅ **All cases pass** after fixing the 13 defects listed below (two passes plus a currency review) |

### How to re-run

```bash
docker compose up --build -d                          # fresh stack
node scripts/api-test.mjs                             # 32 API cases (≈3 s)
RUN_RATE_LIMIT=1 node scripts/api-test.mjs            # + login throttling (locks login ~60 s)
docker compose exec backend node dist/database/seed/seed.js --reset   # restore clean data afterwards
```

The UI cases (`TC-UI-*`) are run by hand in the browser. Steps and expected results are below.

---

## Defects found during this run (all fixed and re-tested)

| # | Severity | Found in | Defect | Fix | Regression test |
|---|---|---|---|---|---|
| D1 | **High** | TC-UI-CRE-11 | Client rejected valid prices such as **19.99** and **1.10** with "Max 2 decimal places". The check used float maths (`19.99 × 100 = 1998.9999…`), so **9,175 of the 99,999 prices from 0.01 to 999.99** were wrongly rejected. | The decimal-place check now runs on the typed text | `invoice-form.schema.test.ts` checks every price from 0.01 to 999.99; the backend equivalent checks the same range (backend was not affected) |
| D2 | Medium | TC-UI-AUTH-07 | After being redirected from a deep link (e.g. `/invoices/<id>`), a successful login went to `/invoices` instead of the requested page. `login()` re-rendered the page and its "already signed in" redirect won the race. | Both redirects use the same computed destination (path + query) | `LoginPage.test.tsx`: "returns the user to the deep link…" (confirmed to fail on the old code) |
| D3 | Medium | TC-UI-CRE-02 | Clicking **Create invoice** while a field was focused could do nothing. The blur showed an error message, which pushed the button down mid-click, so the click was lost. The same applied to the login button. | Helper-text space is always reserved, so errors appear without shifting the layout | Verified in Chrome: clearing Quantity then clicking Create submits on the first click |
| D4 | Medium | TC-UI-LIST-11 | Date filters: typing a year sent intermediate dates (`0002-…`, `0020-…`, `0202-…`) to the API on every keystroke, and a 5-digit year reset the field mid-typing. At 1024 px the year segment was also cut off (`dd/mm/`). | New `DateFilterField` keeps local state and commits only empty or plausible dates. The filter bar grid was rebalanced. | `DateFilterField.test.tsx`; verified in Chrome that typing `01/09/2026` sends exactly one request |
| D5 | Low | TC-UI-CRE-09 | A discount larger than subtotal + tax was accepted by the form (it showed "Estimated total: −89.00") and only rejected after the round trip to the server. The server's 3-decimal error was also vague. | The same rule was added on the client, and the server message was clarified ("…at most 2 decimal places") | `CreateInvoicePage.test.tsx`: "blocks a discount larger than subtotal + tax…" |

### Second pass: exploratory edge-case hunt (2026-09-30)

Probes beyond the spec, run against a fresh stack. Fixed and covered by tests:

| # | Severity | Probe | Defect | Fix | Regression test |
|---|---|---|---|---|---|
| D6 | **High** | Search for `%` or `_` | Returned **every** invoice. Prisma's `contains` builds `ILIKE '%…%'` without escaping, so the user's `%` acted as a wildcard. | `escapeLike()` escapes `\`, `%`, `_` before querying | Unit (`invoice-query.builder.spec.ts`), e2e (`invoices-list.e2e-spec.ts`), API script |
| D7 | **High** | POST without a `customer` object | **500 Internal server error**: `@ValidateNested` skips a missing object, so the service crashed on `dto.customer.fullname` | `@IsDefined` + `@IsObject` on `customer` → 400 "customer is required" | DTO unit test, e2e, API script |
| D8 | Medium | qty 999,999 × rate 999,999,999.99 | Totals above ~90 trillion **lost their cents** in the JSON response (JS numbers are exact only below 2^53 / 100) | Caps: quantity ≤ 100,000, rate ≤ 100,000,000 (largest total 2×10^13), mirrored in the form | DTO + form schema tests |
| D9 | Low | Invoice dated year 9999 | Accepted by the API (the UI filters already limited years to 1900–2999) | Named `isPlausibleYear` validator (1900–2999) on every API date, mirrored in the form | DTO + form schema tests |
| D10 | Low | Date `03/07/2026` | Also produced a misleading "dueDate must be on or after invoiceDate" (string compare on invalid input). Adding the year check revealed that a second `@Matches` silently replaces the first one's message (class-validator keys constraints by name). | Due-date rule only compares valid dates; year rule registered under its own name | Existing DTO test now asserts the exact messages |

| D11 | Medium | 200-character customer name with no spaces, in the list | The Customer column stretched to about 1,730 px and pushed the date, total and status columns off-screen | List cells cap their width and ellipsize, with the full text as a tooltip; detail line items wrap | `InvoiceListPage.test.tsx`: "truncates very long values…" |
| D12 | Low | "Session expired" banner | Used MUI's default cyan info colour, outside the single-accent palette | `palette.info` mapped to the brand navy | Visual check |

| D13 | Medium | VND invoice with rate `1000.50` (found while reviewing a payment-systems reference: "use a scale table per currency") | VND has **0 minor units** (ISO 4217), but the app accepted decimals and rounded VND tax to 2 decimal places | Currency scale table (`minorUnits`: 2, VND 0) drives validation, rounding (tax to whole dong), UI formatting (`₫47,304,527`) and input steps; the seed now includes VND invoices | Calculator, DTO and form-schema unit tests; detail page test; `TC-CREATE-API-14` |

Verified correct in the same pass (UI): a `<script>` customer name renders as text and nothing executes; a corrupted token → 401 → session cleared → "Your session has expired" on /login; **double-clicking Create sends exactly one POST**; a 200-character name wraps cleanly on the detail page.

Verified correct in the same pass (API): 5 parallel creates with the same number → exactly one 201 and four 409s; accented search (`Nguyễn` / `NGUYỄN` / `ánh`); `page=2147483648` → empty page; `pageSize=abc`, `page=-1`, `page=1.5` → clear 400s; 2 MB body → 413 in the standard error shape; 201-character name, lowercase currency and 2027-02-29 → 400.

**Not defects (noted during testing):**
- The automation tool's `type` action can't fill native date inputs; real key presses work.
- Clicks made during the ~200 ms close animation of an MUI dropdown are absorbed by the closing menu. That's standard MUI behaviour, not something a user would notice.

---

## 1. Authentication (spec §2.1.1, §2.3.3)

| ID | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| TC-UI-AUTH-01 | Protected route while logged out | Open `/invoices` with no session | Redirected to `/login` | ✅ |
| TC-UI-AUTH-02 | Empty submit | Click **Sign in** with empty fields | "Email is required", "Password is required"; **no request sent** | ✅ |
| TC-UI-AUTH-03 | Invalid email format | Email `not-an-email` → Sign in | "Enter a valid email address"; no request sent | ✅ |
| TC-UI-AUTH-04 | Wrong password | `admin@simpleinvoice.dev` / `WrongPassword` | Alert "Invalid email or password"; stays on /login; **password field cleared** | ✅ |
| TC-UI-AUTH-05 | Unknown email | `ghost@simpleinvoice.dev` / any | **Same** message as a wrong password (no account enumeration) | ✅ |
| TC-UI-AUTH-06 | Valid login | Demo credentials | Lands on the invoice list; user name in the header | ✅ |
| TC-UI-AUTH-07 | Deep link return | Logged out, open `/invoices/099ca7da-…` → log in | Returned to **that invoice**, not the list | ✅ (after fix D2) |
| TC-UI-AUTH-08 | Refresh keeps session | Reload any page while logged in | Still logged in, no flash of the login page | ✅ |
| TC-UI-AUTH-09 | Sign out | Click **Sign out**, then browser **Back** | On /login; Back cannot show the list; session cleared | ✅ |
| TC-AUTH-10 | Token checks (API) | Missing / `Token abc` / malformed / `alg:none` token | 401 `{statusCode,message,error}` | ✅ |
| TC-AUTH-11 | Login validation (API) | `{email:"nope",password:""}` | 400 with message array | ✅ |
| TC-AUTH-12 | Enumeration (API) | Wrong password vs unknown email | Identical 401 bodies | ✅ |
| TC-AUTH-13 | JWT issued (API) | Valid login (email in upper case) | Bearer JWT, `expiresIn` 3600, no password hash in the response | ✅ |
| TC-AUTH-14 | `/auth/me` (API) | GET with token | Current user profile | ✅ |
| TC-AUTH-15 | Mass assignment (API) | Login body with `role:"admin"` | 400 "property role should not exist" | ✅ |
| TC-AUTH-16 | Brute force (API) | 12 rapid failed logins | 429 after the limit (10/min) | ✅ |

## 2. Invoice list (spec §2.1.2, §2.3.1)

| ID | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| TC-UI-LIST-01 | Default landing | Log in | Columns: Invoice #, Customer, Invoice date, Due date, Total, Status; 10 rows; "1–10 of 41" | ✅ |
| TC-UI-LIST-02 | Status filter | Status → Draft / Pending / Paid / Overdue | 10 / 8 / 13 / 10 rows, **sum = 41**; each row shows the filtered status | ✅ |
| TC-UI-LIST-03 | Search by customer | Type `OLIV` | 4 × "Olivia Tan" (case-insensitive, partial) | ✅ |
| TC-UI-LIST-04 | Search by invoice # | Type `iv1780` | Only `IV1780488206995` | ✅ |
| TC-UI-LIST-05 | No match | Type `zzzz` | "No invoices found" empty state | ✅ |
| TC-UI-LIST-06 | Debounced search | Type `charlotte` (9 keystrokes) | **Exactly 1** API request | ✅ |
| TC-UI-LIST-07 | Clear filters | Click **Clear** | URL reset, search box emptied, 41 invoices | ✅ |
| TC-UI-LIST-08 | Sort by header | Click Total / Due date / Invoice date twice each | DESC then ASC for each; Total DESC starts S$81,955.28, ASC starts US$516.79; dropdown stays in sync; resets to page 1 | ✅ |
| TC-UI-LIST-09 | Pagination | Next page | "11–20 of 41", no overlap with page 1 | ✅ |
| TC-UI-LIST-10 | Page size | Rows per page → 20 | 20 rows, "1–20 of 41", back on page 1 | ✅ |
| TC-UI-LIST-11 | Date range (keyboard) | From `01/09/2026` | One request with `fromDate=2026-09-01`; 21 invoices | ✅ (after fix D4) |
| TC-UI-LIST-12 | Inclusive bounds | From = To = `03/06/2026` | Exactly `IV1780488206995` | ✅ |
| TC-UI-LIST-13 | Combined + reload | Open `?keyword=inv-&status=Paid&sortBy=totalAmount&ordering=ASC`, reload | Controls restored from the URL; 13 Paid rows, ascending totals | ✅ |
| TC-UI-LIST-14 | Past the last page | Open `?page=99` | "This page is past the end of the results" + **Go to first page** works | ✅ |
| TC-UI-LIST-15 | Row opens detail | Click a row | Navigates to that invoice's detail | ✅ |
| TC-UI-LIST-16 | Mobile layout | 375×812 viewport | Cards instead of a table; no horizontal scroll; "New" button | ✅ |
| TC-LIST-API-01..07 | API list contract | See `scripts/api-test.mjs` | Envelope/defaults, partition, search, 6 sort combinations, full page walk with no duplicates, inclusive dates, 400 listing all 6 bad params | ✅ |

## 3. Invoice detail (spec §2.1.3)

| ID | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| TC-UI-DET-01 | Appendix A invoice | Open `IV1780488206995` | Invoice info, customer (Paul, paul@101digital.io, 947717364111, Singapore), 1 line (Honda RC150 × 2 @ 1,000), Subtotal **2,000.00**, Tax (10%) **200.00**, Discount **−20.00**, Total **2,180.00**, Paid **1,451.34**, Balance **728.66**, status **Overdue** | ✅ |
| TC-UI-DET-02 | Optional fields empty | Open an invoice created without mobile/address/reference | Shown as "—", never "null" | ✅ |
| TC-UI-DET-03 | Unknown / invalid id | `/invoices/00000000-…` and `/invoices/not-a-uuid` | "Invoice not found" (no crash, no spinner) | ✅ |
| TC-UI-DET-04 | Unknown route | `/some/unknown/page` | "Page not found" + link back | ✅ |
| TC-DETAIL-API-01..02 | API | See script | Figures exact; 404 `Invoice not found`; 400 for non-UUID | ✅ |

## 4. Create invoice (spec §2.1.4, §2.3.2)

| ID | Scenario | Input | Expected | Result |
|---|---|---|---|---|
| TC-UI-CRE-01 | Happy path (Appendix A inputs) | TEST-001, 01/12/2026 → 31/12/2026, AUD, Paul…, Honda RC150, qty 2, rate 1000, tax 10, discount 20 | Toast "Invoice TEST-001 created", redirect to list, row at top (42 invoices); detail 2,000 / 200 / −20 / **2,180**, paid 0, balance 2,180, **Draft** | ✅ |
| TC-UI-CRE-02 | Required fields | Clear Quantity, click **Create** once | Submits on the **first** click; errors for invoice #, customer name, email, item, quantity, rate; no request | ✅ (after fix D3) |
| TC-UI-CRE-03 | Field rules | email `nope`, qty `1.5`, rate `10.999`, tax `-1`, discount `-1`, due before invoice date | "Enter a valid email address", "Quantity must be a whole number", "Max 2 decimal places", "Tax cannot be negative", "Discount cannot be negative", "Due date must be on or after the invoice date" | ✅ |
| TC-UI-CRE-04 | Duplicate number (any case) | `test-001` | Field error "This invoice number is already in use", field focused, **all input kept** | ✅ |
| TC-UI-CRE-05 | Back-dated + rounding + blank tax/discount + SGD | TEST-003, 05/01/2026 → 05/02/2026, qty 3 × 33.33, tax & discount blank | Toast "created — status **Overdue**"; list shows **S$109.99** (99.99 + 10.00 default tax) | ✅ |
| TC-UI-CRE-06 | Estimate | Appendix A inputs | "Estimated total: 2,180.00 · final amount is calculated by the server" | ✅ |
| TC-UI-CRE-07 | Currency select | Choose SGD | Symbol S$ shown in the list | ✅ |
| TC-UI-CRE-08 | Keyboard dates | Type dates with the keyboard | Values `2026-12-01` / `2026-12-31` accepted | ✅ |
| TC-UI-CRE-09 | Discount > subtotal + tax | qty 3 × 19.99, discount 70 | Blocked on the client: "Discount cannot exceed subtotal plus tax"; the server also rejects it (400) | ✅ (after fix D5) |
| TC-UI-CRE-10 | Common price | Rate `19.99`, discount 5.50 | Accepted; total **AU$60.47** (59.97 + 6.00 − 5.50) | ✅ (after fix D1) |
| TC-CREATE-API-01..13 | API | See script | Server totals; defaults 10% / 0; half-up rounding; Overdue on create; due = invoice date allowed; case-insensitive 409; every field rule; no negative totals; client cannot set totals/status/createdBy; symbols US$/£/S$/€; malformed JSON → 400 | ✅ |

## 5. Platform, security & packaging (spec §2.3.5–§2.4)

| ID | Scenario | Expected | Result |
|---|---|---|---|
| TC-API-01 | `/health` | Public, `{status:"ok"}` | ✅ |
| TC-API-02 | Swagger | `/api/docs` 200; OpenAPI lists all 5 endpoints and all 8 list query params | ✅ |
| TC-API-03 | Headers | `x-request-id` echoed; `nosniff`, HSTS present | ✅ |
| TC-PKG-01 | One command from zero | `docker compose down -v && docker compose up --build`: db → migrations → seed (Appendix A verified) → API healthy → web, in ≈15 s | ✅ |
| TC-PKG-02 | Data survives restart | Create invoices, `docker compose restart backend` | Invoices still there; seed says "already present — skipping" | ✅ |
| TC-PKG-03 | Frontend security headers | Response from :8080 | CSP (`connect-src` allows only the API origin), `X-Frame-Options: DENY`, `nosniff` | ✅ |
| TC-PKG-04 | Browser console | Browse every screen | No errors | ✅ |

## 6. Automated suites (same run)

| Suite | Command | Result |
|---|---|---|
| Backend unit | `cd backend && npm test` | 72 / 72 ✅ |
| Backend e2e (Testcontainers) | `cd backend && npm run test:e2e` | 51 / 51 ✅ |
| Frontend | `cd frontend && npm test` | 56 / 56 ✅ |
| API black-box | `RUN_RATE_LIMIT=1 node scripts/api-test.mjs` | 33 / 33 ✅ |
| Browser smoke (Playwright) | `cd frontend && npm run test:e2e` | 1 / 1 ✅ (also 3 / 3 with `--repeat-each=3`, parallel) |
| Lint + typecheck | `npm run lint && npm run typecheck` (both apps) | clean ✅ |
