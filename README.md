# Box Cricket Booking System (V1)

Internal booking, payment, and daily-operations tool for a box cricket ground.
Two users only: the **Owner** (create/edit/cancel bookings, reports, worker
management) and the on-site **Worker** (arrivals, payments, extra items,
completion, "starts soon" reminders). No customer-facing pages.

**Stack:** Angular + Angular Material SPA · Express (TypeScript) on a Vercel
serverless function · Neon Postgres · JWT auth.

## Repo layout

- `db/` — `schema.sql` (locked schema, applied manually) and `seed-users.ts`
- `api/` — Express backend; `api/index.ts` is the Vercel function entry
- `frontend/` — Angular SPA
- `docs/` — planning docs, design spec, implementation plans

## 1. Neon setup (once)

1. Create a Neon project.
2. Open the SQL editor and run the whole of `db/schema.sql` (or `psql "$URL" -f db/schema.sql`).
3. Create two branches from `main`: `dev` and `test`.
4. Copy the **pooled** connection string (host contains `-pooler`) for each branch.

## 2. Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled connection string — `dev` branch locally, `main` in Vercel |
| `DATABASE_URL_TEST` | Pooled connection string of the `test` branch (integration tests) |
| `JWT_SECRET` | Signing secret — generate with `openssl rand -base64 32` |

Never commit `.env`. In Vercel, set `DATABASE_URL` and `JWT_SECRET` under
Project → Settings → Environment Variables.

## 3. Create the two accounts

```bash
OWNER_NAME="..." OWNER_PHONE="..." OWNER_PASSWORD="..." \
WORKER_NAME="..." WORKER_PHONE="..." WORKER_PASSWORD="..." \
npm run seed:users
```

Re-running updates the accounts (upsert by phone). Run it once against the
production `DATABASE_URL` after deploying. There is no signup flow.

## 4. Run locally

```bash
npm install
npm run dev        # API on :3000 + Angular on :4200 (proxies /api)
```

Log in at http://localhost:4200 with a seeded phone/email + password.

**Tests:**

```bash
npm run test:api                                   # backend (Neon test branch)
cd frontend && npm test -- --watch=false          # Vitest (Angular 22 unit-test builder)
```

## 5. Deploy to Vercel

1. Push to GitHub and import the repo in Vercel (framework preset: Other —
   `vercel.json` drives the build).
2. Set `DATABASE_URL` (main-branch pooled string) and `JWT_SECRET`.
3. Deploy. The Angular build is served statically; `api/index.ts` becomes the
   single serverless function behind `/api/*`.
4. Seed production users (step 3) and log in.

## 6. Handover checklist

- Transfer the Vercel project (with its Neon integration) to the client's account.
- Transfer the GitHub repository.
- Rotate `JWT_SECRET` and reset the Neon database password.
- Re-seed owner/worker credentials chosen by the client.
