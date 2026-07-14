# Box Cricket Ground Booking System — Version 1 Design

**Date:** 2026-07-10
**Status:** Approved for planning
**Related:** `docs/planning/` (problem statement, project overview, V1 plan)

## 1. Context & Goal

A local box cricket ground manages bookings, payments, and daily operations in a paper notebook. V1 replaces the notebook with a small internal web tool for exactly two users — the ground's **Owner** and a single on-site **Worker**. The business process does not change: the owner still takes bookings by phone; the software replaces record keeping, owner→worker communication, and payment tracking.

No customer-facing interface, no payment gateway, no notifications. Keep it simple and CRUD-focused.

## 2. Confirmed Constraints (locked — do not deviate)

| Layer | Technology |
|---|---|
| Frontend | Angular SPA (no SSR), Angular Material |
| Backend | Node.js + Express, TypeScript |
| Database | PostgreSQL on Neon |
| Auth | JWT login, no public registration |
| Hosting | Vercel — static frontend build + one serverless function |

**Serverless implications:** no in-memory state or background jobs may survive between requests; DB access uses Neon's **pooled** connection string; the "starts in 30 min" reminder is a polled query, never a scheduled job.

**Database schema:** already designed and reviewed — applied verbatim via Neon SQL editor/`psql` (full SQL in Appendix A; stored in the repo as `db/schema.sql`). Do not alter table structure or constraint logic without flagging it first.

## 3. Decisions Made During Design

| Decision | Choice |
|---|---|
| Repo root | `Box-Cricket/` is the git repo and Vercel project root |
| Deployment topology | **Single Vercel project**: static Angular build + one Express serverless function handling all `/api/*` routes; same origin, no CORS |
| DB driver | `@neondatabase/serverless` (HTTP), raw parameterized SQL, no ORM |
| UI foundation | Angular Material; Chart.js (ng2-charts) for the trends chart — the only other UI dependency |
| Responsiveness | **Every screen — owner's and worker's — must work on both small-screen mobile and desktop browsers.** Tables collapse to cards on small screens, dialogs go full-screen on mobile, nav adapts |
| Worker visibility window | Today + future, **plus the last 7 days read-only**. Worker can act only on today/future bookings |
| `no_show` marking | Both roles may mark it (the worker is on site); cancel stays owner-only |
| Corrections | Owner-only **delete** of a mis-entered payment or item (delete and re-add; no edit-in-place) |
| JWT | 12-hour expiry, no refresh token; claims `{ sub, role, name }`; stored in `localStorage`, attached via Angular interceptor |
| Password hashing | `bcryptjs` (pure JS, serverless-safe) |
| Validation | Zod schemas at every route boundary |
| Dev/test DB | Neon branches — `dev` for local development, `test` for integration tests. The Neon HTTP driver doesn't speak to plain local Postgres, so no local DB |
| Timezone | Store `TIMESTAMPTZ` (UTC); display in browser local time (both users are IST); server uses a single `Asia/Kolkata` constant for report date-bucketing |
| Account creation | One-time local seed script (`db/seed-users.ts`) creates the Owner and Worker with bcrypt hashes; credentials via env/prompt, never committed |
| Testing depth | Full stack: backend unit + integration tests, plus Angular service/component tests. No e2e suite in V1 (manual UAT covers it) |

## 4. Repo Layout

```
Box-Cricket/                      ← git repo root, Vercel project root
├── docs/
│   ├── planning/                 ← original planning docs
│   └── superpowers/specs/        ← this design doc
├── db/
│   ├── schema.sql                ← confirmed schema, verbatim (Appendix A)
│   └── seed-users.ts             ← one-time Owner/Worker account seeding
├── api/                          ← Express + TypeScript backend
│   ├── index.ts                  ← Vercel serverless entry — exports the Express app
│   └── src/                      ← app setup, routes/, middleware/, db client, config
├── frontend/                     ← Angular SPA
│   └── src/app/
│       ├── core/                 ← auth service, interceptor, guards, typed API services
│       ├── shared/               ← status chip, balance display, ₹ currency pipe
│       └── features/
│           ├── owner/            ← bookings list/detail, reports, settings
│           └── worker/           ← dashboard, booking detail
├── vercel.json                   ← /api/* → function; everything else → static build
├── package.json
└── README.md
```

## 5. Roles & Permissions (enforced server-side from the JWT `role` claim)

| Capability | Owner | Worker |
|---|---|---|
| Create / edit / cancel booking | ✅ | ❌ |
| View bookings | ✅ all | ✅ today −7d → future (past 7 days read-only) |
| Mark arrival / completed | ✅ | ✅ (today/future only) |
| Mark no-show | ✅ | ✅ (today/future only) |
| Record payment / add extra items | ✅ | ✅ (today/future only) |
| Delete a payment or item (correction) | ✅ | ❌ |
| Reports/analytics | ✅ | ❌ |
| Manage worker account | ✅ | ❌ |
| "Starts in 30 min" reminder | ❌ | ✅ |

Only two accounts exist. No registration flow anywhere. Roles are never read from request body/query.

## 6. Business Rules

1. **Slot duration:** booking form defaults end time to start + 2 hours, editable. `start_time`/`end_time` are free timestamps; no 2-hour assumption in any validation logic.
2. **Courts:** V1 has one seeded court, but all booking logic is generic over `court_id` — adding a court later is a data change only.
3. **Cancellation / no-show:** setting status to `cancelled` or `no_show` sets `advance_forfeited = TRUE`. No refund logic exists. `cancellation_reason` is optional text captured on cancel.
4. **Payments:** cash or UPI (site QR code, outside this app). The app only logs amount + type (`advance`/`remaining`/`extra`) + method. No gateway, no verification. The schema's `payment_method` enum also contains `card` and `online` for future use, but the V1 UI and API validation accept only `cash` and `upi`.
5. **Reminders:** worker-only. Computed on demand: `status = 'confirmed' AND start_time BETWEEN now() AND now() + interval '30 minutes' AND NOT reminder_acknowledged`. Dismissing the banner sets `reminder_acknowledged = TRUE`.
6. **Double booking:** prevented by the DB exclusion constraint. The API maps Postgres error `23P01` on `no_overlapping_bookings` to HTTP 409 with a clean message.
7. **Status transitions** (validated server-side; anything else → 422):
   `confirmed → arrived → completed`; `confirmed → cancelled`; `confirmed → no_show`.

## 7. API Design

`POST /api/auth/login` — `{ identifier, password }` (identifier = phone or email) → `{ token, user }`. Verifies bcrypt hash and `is_active`.

All other routes require `requireAuth`; owner-only routes add `requireRole('owner')`.

| Endpoint | Who | Purpose |
|---|---|---|
| `GET /courts` | both | list active courts (feeds the booking form's court selection; auto-picked when only one exists) |
| `GET /bookings` | both | list/search: `?date=`, `?from/to=`, `?status=`, `?q=` (name/phone). Worker results force-clamped server-side to today −7d → future |
| `POST /bookings` | owner | create |
| `GET /bookings/:id` | both | detail + payments + items + balance (via `booking_balances` view) |
| `PATCH /bookings/:id` | owner | edit details/times (re-hits exclusion constraint) |
| `POST /bookings/:id/cancel` | owner | → `cancelled`, forfeits advance, optional reason |
| `POST /bookings/:id/no-show` | both | → `no_show`, forfeits advance |
| `POST /bookings/:id/arrive` | both | → `arrived` |
| `POST /bookings/:id/complete` | both | → `completed` |
| `POST /bookings/:id/payments` | both | log `{ amount, type, method }` |
| `DELETE /payments/:id` | owner | correction delete |
| `POST /bookings/:id/items` | both | add `{ item_name, quantity, unit_price }` |
| `DELETE /items/:id` | owner | correction delete |
| `GET /reminders` | worker | reminder query above |
| `POST /reminders/:bookingId/ack` | worker | acknowledge |
| `GET /reports/summary?from=&to=` | owner | revenue, booking counts, forfeited advances |
| `GET /reports/pending` | owner | bookings with `balance_due > 0`, excluding `cancelled` and `no_show` (a no-show's balance is uncollectable; its advance is already forfeited) |
| `GET /reports/trends?from=&to=` | owner | bookings + revenue per day |
| `GET /users/worker` | owner | view worker account |
| `PATCH /users/:id` | owner | update worker (name/phone/email/password/`is_active`) or own password |

Worker mutations (`arrive`, `complete`, `no-show`, `payments`, `items`) are rejected with 403 when the booking's `booking_date` is before today (evaluated in `Asia/Kolkata`).

**Error handling.** One error middleware; uniform shape `{ error: { code, message } }`:
Zod failure → 400 · bad/missing JWT → 401 · wrong role or worker acting outside window → 403 · unknown id → 404 · invalid status transition → 422 · `23P01` overlap → 409 "This time slot overlaps an existing booking on this court." Raw DB errors never reach the client.

## 8. Frontend Design

All screens responsive (mobile + desktop) for both roles.

```
/login                    identifier + password

/owner/bookings           owner home: list + search (date, status, name/phone);
                          "New booking" Material dialog — date/time pickers,
                          end defaults to start + 2h, editable
/owner/bookings/:id       detail: status timeline, payments, items, balance due;
                          actions: edit, cancel (reason prompt), arrive/no-show/
                          complete, delete payment/item
/owner/reports            summary cards, pending-payments table,
                          bookings/revenue-per-day chart, date-range picker
/owner/settings           worker account management + change own password

/worker                   worker home: reminder banner (polls GET /reminders
                          every 60 s; dismiss = ack), today's bookings as cards,
                          upcoming days, last-7-days section (read-only)
/worker/bookings/:id      same detail view, worker-permitted actions only,
                          only for today/future bookings
```

- Guards: `authGuard` + `roleGuard`; post-login redirect by role. Server remains the real enforcement — a worker deep-linking owner URLs also gets API 403s.
- `core/` holds one typed API service per resource (`BookingsApi`, `PaymentsApi`, …) mirroring the endpoint table; components never touch `HttpClient` directly.
- Interceptor attaches the JWT and redirects to `/login` on 401.
- Booking forms send ISO timestamps and the picked `booking_date`; no timezone math in the browser.
- Every mutation shows a snackbar with success or the server's clean error (including the 409 overlap message).
- Standalone components throughout; no NgModules.

## 9. Testing Strategy

**Backend — Vitest + Supertest.**
- *Unit:* status-transition rules, Zod schemas, JWT middleware, Postgres-error→HTTP mapping.
- *Integration:* full Express app against the **Neon `test` branch** (real exclusion constraint and `booking_balances` view), tables truncated between suites. Core scenarios: login failures (bad password, inactive user); worker token → 403 on every owner-only route; worker list clamped to the visibility window; overlap on create/edit → 409; payments + items math matches `booking_balances`; cancel/no-show set `advance_forfeited`; reminder window + acknowledgment.

**Frontend — Angular TestBed (Jasmine/Karma as the CLI ships).**
Service tests (request shapes, auth header, 401 redirect) and component tests for the booking form (2-h default, validation), reminder banner (mock polling, dismiss), guard redirects, and balance/status display components.

**No e2e suite in V1** — manual UAT with the real owner and worker, per the phase plan.

## 10. Deployment & Handover

README covers:
1. **Neon setup:** create project, apply `db/schema.sql`, create `dev` and `test` branches, run `db/seed-users.ts` for the two accounts.
2. **Env vars:** `DATABASE_URL` (pooled connection string) and `JWT_SECRET` — in `.env` locally (gitignored), in Vercel project settings for deploys. Never hardcoded.
3. **Local dev:** single `npm run dev` runs Angular dev server proxying `/api` to the local Express app against the Neon `dev` branch.
4. **Deploy:** push to GitHub → Vercel builds the Angular static output and the single serverless function.
5. **Handover:** transfer the Vercel project (with Neon integration) and the GitHub repo to the client's accounts; rotate `JWT_SECRET` and DB credentials seen during development.

## 11. Out of Scope for V1

- Customer accounts, customer login, any public-facing page
- Online payment collection / payment gateway
- SMS/WhatsApp/email notifications
- Refund or partial-refund workflows
- Multiple workers or self-registration
- Dynamic/peak pricing
- Multi-venue switching in the UI (schema supports it; UI ignores it)

## Appendix A — Database Schema (confirmed, verbatim)

```sql
-- =====================================================================
-- Box Cricket Ground — Booking Management System (Version 1)
-- PostgreSQL schema — Hosted on Neon
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role AS ENUM ('owner', 'worker');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    phone         VARCHAR(15)  NOT NULL UNIQUE,
    email         VARCHAR(150) UNIQUE,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venues (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(150) NOT NULL,
    address    TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id   UUID NOT NULL REFERENCES venues(id),
    name       VARCHAR(100) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE booking_status AS ENUM (
    'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'
);

CREATE TABLE bookings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id              UUID NOT NULL REFERENCES courts(id),
    customer_name         VARCHAR(100) NOT NULL,
    customer_phone        VARCHAR(15)  NOT NULL,
    booking_date          DATE NOT NULL,
    start_time            TIMESTAMPTZ NOT NULL,
    end_time              TIMESTAMPTZ NOT NULL,
    total_amount          NUMERIC(10,2) NOT NULL,
    status                booking_status NOT NULL DEFAULT 'confirmed',
    advance_forfeited     BOOLEAN NOT NULL DEFAULT FALSE,
    cancellation_reason   TEXT,
    reminder_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    created_by            UUID NOT NULL REFERENCES users(id),
    updated_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_time_order CHECK (end_time > start_time)
);

ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
        court_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'));

CREATE TYPE payment_type   AS ENUM ('advance', 'remaining', 'extra');
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card', 'online');

CREATE TABLE payments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount       NUMERIC(10,2) NOT NULL,
    type         payment_type NOT NULL,
    method       payment_method NOT NULL DEFAULT 'cash',
    collected_by UUID NOT NULL REFERENCES users(id),
    paid_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE booking_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    item_name   VARCHAR(100) NOT NULL,
    quantity    INT NOT NULL DEFAULT 1,
    unit_price  NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    added_by    UUID NOT NULL REFERENCES users(id),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE VIEW booking_balances AS
SELECT
    b.id AS booking_id,
    b.total_amount + COALESCE(items.items_total, 0)  AS total_due,
    COALESCE(pay.total_paid, 0)                       AS total_paid,
    (b.total_amount + COALESCE(items.items_total, 0))
        - COALESCE(pay.total_paid, 0)                 AS balance_due
FROM bookings b
LEFT JOIN (
    SELECT booking_id, SUM(total_price) AS items_total
    FROM booking_items GROUP BY booking_id
) items ON items.booking_id = b.id
LEFT JOIN (
    SELECT booking_id, SUM(amount) AS total_paid
    FROM payments GROUP BY booking_id
) pay ON pay.booking_id = b.id;

CREATE INDEX idx_bookings_date    ON bookings(booking_date);
CREATE INDEX idx_bookings_status  ON bookings(status);
CREATE INDEX idx_bookings_phone   ON bookings(customer_phone);
CREATE INDEX idx_bookings_court   ON bookings(court_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);

WITH v AS (
    INSERT INTO venues (name) VALUES ('Main Ground') RETURNING id
)
INSERT INTO courts (venue_id, name) SELECT id, 'Court 1' FROM v;
```
