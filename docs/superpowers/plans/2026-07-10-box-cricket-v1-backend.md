# Box Cricket V1 — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Express + TypeScript backend for the box cricket booking system — auth, bookings, payments, extra items, reminders, reports, and user management — deployable as one Vercel serverless function against Neon Postgres.

**Architecture:** One Express app exported from `api/index.ts` (Vercel zero-config function) handling all `/api/*` routes. Raw parameterized SQL through `@neondatabase/serverless` (HTTP driver, no pool to manage). All authorization decided server-side from the JWT `role` claim. Integration tests hit a real Neon `test` branch so the exclusion constraint and `booking_balances` view are exercised for real.

**Tech Stack:** Node 20+, Express 5, TypeScript (strict), `@neondatabase/serverless`, Zod, `jsonwebtoken`, `bcryptjs`, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-07-10-box-cricket-v1-design.md` — read §5–§7 before starting. The database schema is in its Appendix A and is **locked**.

## Global Constraints

- Tech stack is locked (spec §2). Do not add an ORM, a session store, or any background job.
- The schema is applied **verbatim** from spec Appendix A into `db/schema.sql`. Application code never runs DDL and never alters the schema.
- No in-memory state may matter across requests (serverless: one function invocation per request).
- Secrets only via env vars: `DATABASE_URL` (Neon **pooled** string), `JWT_SECRET`. Tests additionally use `DATABASE_URL_TEST`. Never hardcode either.
- Every error response has the shape `{ "error": { "code": string, "message": string } }`. Raw DB errors never reach the client.
- Payment `method` accepted by the API is **only** `'cash'` or `'upi'` (schema enum has more values; V1 rejects them).
- Role checks come only from the verified JWT — never from body/query.
- Status transitions allowed: `confirmed → arrived → completed`, `confirmed → cancelled`, `confirmed → no_show`. Anything else → 422.
- Worker window: can **see** bookings with `booking_date >= today − 7 days`, can **mutate** only `booking_date >= today` — "today" evaluated in `Asia/Kolkata`. All date comparisons happen in SQL (`$n::date` params), never on JS `Date` objects.
- Postgres `NUMERIC` values (amounts, balances) travel as **strings** in JSON. Do not parse them server-side; the frontend formats them.
- Implementation decision (noted): backend npm dependencies live in the **root** `package.json` (not `api/package.json`) so Vercel's function bundler resolves them without workspace configuration. `api/` stays the source directory per the spec layout.

## Prerequisites (human setup — block and ask the user if missing)

1. Neon project created; `db/schema.sql` applied to the **main** branch (Neon SQL editor or `psql`), then two branches created from it: `dev` and `test` (branches copy schema + seed rows).
2. A root `.env` file (gitignored) with:
   - `DATABASE_URL` — pooled connection string of the **dev** branch
   - `DATABASE_URL_TEST` — pooled connection string of the **test** branch
   - `JWT_SECRET` — e.g. output of `openssl rand -base64 32`
3. Node 20+ and npm available.

---

### Task 1: Repo scaffold, toolchain, and schema file

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `db/schema.sql`, `tsconfig.json`, `vitest.config.ts`

**Interfaces:**
- Produces: npm scripts `dev:api`, `test:api`, `typecheck`, `seed:users` used by every later task; `db/schema.sql` used by the Prerequisites and Neon setup.

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "box-cricket",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev:api": "tsx watch api/local-dev.ts",
    "test:api": "vitest run",
    "typecheck": "tsc --noEmit",
    "seed:users": "tsx db/seed-users.ts"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.0.0",
    "bcryptjs": "^2.4.3",
    "express": "^5.0.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.0",
    "@types/supertest": "^6.0.2",
    "dotenv": "^16.4.7",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^3.0.0"
  }
}
```

Express 5 is deliberate: rejected promises in async handlers propagate to the error middleware automatically — no wrapper needed anywhere.

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
.env
.env.*
!.env.example
.angular/
.vercel/
```

- [ ] **Step 3: Write `.env.example`**

```
# Neon POOLED connection strings (host contains "-pooler")
DATABASE_URL=postgres://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_TEST=postgres://user:password@ep-yyy-pooler.region.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=generate-with-openssl-rand-base64-32
```

- [ ] **Step 4: Write `db/schema.sql`**

Copy **verbatim, character for character**, the SQL from Appendix A of `docs/superpowers/specs/2026-07-10-box-cricket-v1-design.md` (starts `CREATE EXTENSION IF NOT EXISTS pgcrypto;`, ends with the venue/court seed INSERT). Do not reformat, rename, or "improve" anything.

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["api/**/*.ts", "db/**/*.ts"]
}
```

- [ ] **Step 6: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/test/**/*.test.ts'],
    setupFiles: ['api/test/setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
```

`fileParallelism: false` because integration test files share one Neon test database.

- [ ] **Step 7: Install and verify**

Run: `npm install`
Expected: completes without errors (peer warnings are fine).

- [ ] **Step 8: Verify the schema is applied (Prerequisites)**

If `.env` exists and `psql` is available:
Run: `psql "$DATABASE_URL" -c "SELECT name FROM courts;"`
Expected: one row, `Court 1`.
If `psql` is unavailable, defer — Task 4's integration tests verify the same thing. If `.env` is missing, **stop and ask the user** to complete the Prerequisites.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example db/schema.sql tsconfig.json vitest.config.ts
git commit -m "chore: scaffold repo toolchain and locked db schema"
```

---

### Task 2: Config, error types, and IST time utilities

**Files:**
- Create: `api/src/config.ts`, `api/src/errors.ts`, `api/src/time.ts`, `api/src/validation.ts`
- Test: `api/test/unit/foundations.test.ts`, `api/test/setup.ts`

**Interfaces:**
- Produces: `config.databaseUrl`, `config.jwtSecret` (lazy getters, throw if env missing); `AppError` + factories `unauthorized(msg?)`, `forbidden(msg?)`, `notFound(msg?)`, `invalidTransition(from, to)`; `todayIST(): string`, `istDateDaysAgo(days: number): string` (both return `YYYY-MM-DD`); regexes `PHONE_RE`, `DATE_RE`.

- [ ] **Step 1: Write the test setup file** (needed before any test runs)

`api/test/setup.ts`:

```ts
import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required to run the test suite (Neon test branch, pooled string)');
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET ??= 'test-secret';
```

- [ ] **Step 2: Write the failing tests**

`api/test/unit/foundations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { AppError, forbidden, invalidTransition, notFound, unauthorized } from '../../src/errors';
import { istDateDaysAgo, todayIST } from '../../src/time';

describe('config', () => {
  it('exposes env-backed values', () => {
    expect(config.databaseUrl).toContain('postgres');
    expect(config.jwtSecret.length).toBeGreaterThan(0);
  });
});

describe('errors', () => {
  it('AppError carries status, code, message', () => {
    const e = new AppError(404, 'NOT_FOUND', 'nope');
    expect(e.status).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toBe('nope');
    expect(e).toBeInstanceOf(Error);
  });

  it('factories produce the right statuses', () => {
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
    const t = invalidTransition('completed', 'arrived');
    expect(t.status).toBe(422);
    expect(t.message).toContain('completed');
    expect(t.message).toContain('arrived');
  });
});

describe('IST time helpers', () => {
  it('todayIST returns YYYY-MM-DD', () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('istDateDaysAgo(0) equals todayIST', () => {
    expect(istDateDaysAgo(0)).toBe(todayIST());
  });

  it('istDateDaysAgo(7) is strictly before today', () => {
    expect(istDateDaysAgo(7) < todayIST()).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run api/test/unit/foundations.test.ts`
Expected: FAIL — cannot resolve `../../src/config` (files don't exist yet).

- [ ] **Step 4: Implement**

`api/src/config.ts`:

```ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
  get jwtSecret(): string {
    return required('JWT_SECRET');
  },
};
```

`api/src/errors.ts`:

```ts
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = 'Invalid credentials') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Not allowed') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found') => new AppError(404, 'NOT_FOUND', msg);
export const invalidTransition = (from: string, to: string) =>
  new AppError(422, 'INVALID_TRANSITION', `Cannot change status from '${from}' to '${to}'`);
```

`api/src/time.ts`:

```ts
const IST = 'Asia/Kolkata';

/** Today's date in Asia/Kolkata as YYYY-MM-DD ('en-CA' locale formats ISO-style). */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST });
}

/** The date `days` days before now, in Asia/Kolkata, as YYYY-MM-DD. */
export function istDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toLocaleDateString('en-CA', { timeZone: IST });
}
```

`api/src/validation.ts`:

```ts
export const PHONE_RE = /^[0-9+\- ]{7,15}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run api/test/unit/foundations.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src api/test
git commit -m "feat: config, error types, and IST time utilities"
```

---

### Task 3: Express app skeleton, DB client, and error middleware

**Files:**
- Create: `api/src/db.ts`, `api/src/middleware/error-handler.ts`, `api/src/app.ts`
- Test: `api/test/unit/error-handler.test.ts`

**Interfaces:**
- Consumes: `config`, `AppError` (Task 2).
- Produces: `db()` — returns the Neon query client; call as `` await db().query(text, params) `` → `Promise<any[]>` (rows). `errorHandler` — Express error middleware. `app` — the Express application with `GET /api/health`; later tasks add `app.use(...)` mounts to it.

- [ ] **Step 1: Write the failing tests**

`api/test/unit/error-handler.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { notFound } from '../../src/errors';
import { errorHandler } from '../../src/middleware/error-handler';
import { app } from '../../src/app';

function appWith(route: (req: express.Request, res: express.Response) => void) {
  const t = express();
  t.get('/t', route);
  t.use(errorHandler);
  return t;
}

describe('errorHandler', () => {
  it('maps AppError to its status and shape', async () => {
    const res = await request(appWith(() => { throw notFound('Booking not found'); })).get('/t');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Booking not found' } });
  });

  it('maps ZodError to 400 with field messages', async () => {
    const res = await request(appWith(() => { z.object({ name: z.string() }).parse({}); })).get('/t');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toContain('name');
  });

  it('maps exclusion-constraint violation (23P01) to the clean 409', async () => {
    const t = express();
    t.get('/t', (_req, _res, next) => next(Object.assign(new Error('conflict'), { code: '23P01' })));
    t.use(errorHandler);
    const res = await request(t).get('/t');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This time slot overlaps an existing booking on this court.');
  });

  it('maps check-constraint violation (23514) to 400', async () => {
    const t = express();
    t.get('/t', (_req, _res, next) => next(Object.assign(new Error('check'), { code: '23514' })));
    t.use(errorHandler);
    const res = await request(t).get('/t');
    expect(res.status).toBe(400);
  });

  it('maps unique violation (23505) to 409 and bad uuid (22P02) to 404', async () => {
    const uniq = express();
    uniq.get('/t', (_req, _res, next) => next(Object.assign(new Error('dup'), { code: '23505' })));
    uniq.use(errorHandler);
    expect((await request(uniq).get('/t')).status).toBe(409);

    const uuid = express();
    uuid.get('/t', (_req, _res, next) => next(Object.assign(new Error('uuid'), { code: '22P02' })));
    uuid.use(errorHandler);
    expect((await request(uuid).get('/t')).status).toBe(404);
  });

  it('hides unknown errors behind a generic 500', async () => {
    const res = await request(appWith(() => { throw new Error('secret db detail'); })).get('/t');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

describe('app skeleton', () => {
  it('serves GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/unit/error-handler.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`api/src/db.ts`:

```ts
import { neon } from '@neondatabase/serverless';
import { config } from './config';

type NeonClient = ReturnType<typeof neon>;

let client: NeonClient | undefined;

/** Lazily-initialized Neon HTTP client. Usage: await db().query('SELECT ... $1', [x]) */
export function db(): NeonClient {
  client ??= neon(config.databaseUrl);
  return client;
}
```

`api/src/middleware/error-handler.ts`:

```ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';

const OVERLAP_MESSAGE = 'This time slot overlaps an existing booking on this court.';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    res.status(400).json({ error: { code: 'VALIDATION', message } });
    return;
  }
  switch (err?.code) {
    case '23P01': // exclusion constraint (double booking)
      res.status(409).json({ error: { code: 'SLOT_OVERLAP', message: OVERLAP_MESSAGE } });
      return;
    case '23505': // unique violation (e.g. duplicate phone)
      res.status(409).json({ error: { code: 'CONFLICT', message: 'That value is already in use.' } });
      return;
    case '23514': // check constraint (end_time > start_time)
      res.status(400).json({ error: { code: 'VALIDATION', message: 'end_time must be after start_time' } });
      return;
    case '22P02': // invalid uuid/enum text in a parameter
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
      return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
```

`api/src/app.ts`:

```ts
import express from 'express';
import { errorHandler } from './middleware/error-handler';

export const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Route mounts are added here by later tasks, always ABOVE the error handler.

app.use(errorHandler);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/unit/error-handler.test.ts`
Expected: all tests PASS. Also run `npm run typecheck` — no errors.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: express app skeleton, neon db client, uniform error middleware"
```

---

### Task 4: Auth — login endpoint, JWT middleware, and integration-test helpers

**Files:**
- Create: `api/src/middleware/auth.ts`, `api/src/routes/auth.ts`, `api/test/helpers.ts`
- Modify: `api/src/app.ts` (mount auth router)
- Test: `api/test/integration/auth.test.ts`

**Interfaces:**
- Consumes: `db()`, `config`, `errorHandler`, error factories.
- Produces:
  - `requireAuth: RequestHandler` — verifies `Authorization: Bearer <jwt>`, sets `req.user: AuthUser` where `AuthUser = { sub: string; role: 'owner' | 'worker'; name: string }`.
  - `requireRole(role: 'owner' | 'worker'): RequestHandler` — 403 unless `req.user.role === role`.
  - `POST /api/auth/login` — body `{ identifier, password }` (identifier = phone or email) → `{ token, user: { id, name, role } }`, JWT expires in 12h.
  - Test helpers: `resetDb(): Promise<void>`, `seedUser(role): Promise<TestUser>` where `TestUser = { id: string; role: 'owner' | 'worker'; token: string }` (password is always `'password123'`, phones `9000000001` owner / `9000000002` worker), `courtId(): Promise<string>`, `bookingPayload(courtId, overrides?)`, `insertBookingAt(courtId, daysOffset, createdBy): Promise<string>`.

- [ ] **Step 1: Write the test helpers**

`api/test/helpers.ts`:

```ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { db } from '../src/db';

export interface TestUser {
  id: string;
  role: 'owner' | 'worker';
  token: string;
}

/** Wipe all mutable data. Venue/court seed rows from schema.sql are kept. */
export async function resetDb(): Promise<void> {
  await db().query('TRUNCATE bookings CASCADE');
  await db().query('DELETE FROM users');
}

export async function seedUser(role: 'owner' | 'worker'): Promise<TestUser> {
  const phone = role === 'owner' ? '9000000001' : '9000000002';
  const hash = bcrypt.hashSync('password123', 4); // low cost: tests only
  const rows = await db().query(
    'INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [`Test ${role}`, phone, hash, role],
  );
  const id = rows[0].id as string;
  const token = jwt.sign({ sub: id, role, name: `Test ${role}` }, config.jwtSecret, { expiresIn: '1h' });
  return { id, role, token };
}

export async function courtId(): Promise<string> {
  const rows = await db().query('SELECT id FROM courts LIMIT 1');
  return rows[0].id as string;
}

/** Valid create-booking payload starting 3h from now, 2h long. */
export function bookingPayload(court: string, overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 3 * 3_600_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  return {
    court_id: court,
    customer_name: 'Test Customer',
    customer_phone: '9876543210',
    booking_date: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    total_amount: 1000,
    ...overrides,
  };
}

/** Directly insert a booking offset by whole days (negative = past). Returns its id. */
export async function insertBookingAt(court: string, daysOffset: number, createdBy: string): Promise<string> {
  const start = new Date(Date.now() + daysOffset * 86_400_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  const rows = await db().query(
    `INSERT INTO bookings (court_id, customer_name, customer_phone, booking_date, start_time, end_time, total_amount, created_by)
     VALUES ($1, 'Offset Customer', '9000000009', $2, $3, $4, 500, $5) RETURNING id`,
    [court, start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), start.toISOString(), end.toISOString(), createdBy],
  );
  return rows[0].id as string;
}
```

- [ ] **Step 2: Write the failing tests**

`api/test/integration/auth.test.ts`:

```ts
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { config } from '../../src/config';
import { db } from '../../src/db';
import { errorHandler } from '../../src/middleware/error-handler';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { resetDb, seedUser } from '../helpers';

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('owner');
    await seedUser('worker');
  });

  it('returns a 12h token and the user for valid phone credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000001', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Test owner', role: 'owner' });
    const payload = jwt.verify(res.body.token, config.jwtSecret) as { role: string; exp: number; iat: number };
    expect(payload.role).toBe('owner');
    expect(payload.exp - payload.iat).toBe(12 * 3600);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000001', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an unknown identifier with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'nobody@x.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('rejects an inactive user with 401', async () => {
    await db().query(`UPDATE users SET is_active = FALSE WHERE phone = '9000000002'`);
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000002', password: 'password123' });
    expect(res.status).toBe(401);
    await db().query(`UPDATE users SET is_active = TRUE WHERE phone = '9000000002'`);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000001' });
    expect(res.status).toBe(400);
  });
});

describe('requireAuth / requireRole', () => {
  const mini = express();
  mini.get('/owner-only', requireAuth, requireRole('owner'), (_req, res) => { res.json({ ok: true }); });
  mini.use(errorHandler);
  const tokenFor = (role: 'owner' | 'worker') =>
    jwt.sign({ sub: '00000000-0000-0000-0000-000000000000', role, name: 't' }, config.jwtSecret);

  it('401 without a token', async () => {
    expect((await request(mini).get('/owner-only')).status).toBe(401);
  });

  it('401 with a garbage token', async () => {
    expect((await request(mini).get('/owner-only').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('403 with a worker token', async () => {
    expect((await request(mini).get('/owner-only').set('Authorization', `Bearer ${tokenFor('worker')}`)).status).toBe(403);
  });

  it('200 with an owner token', async () => {
    expect((await request(mini).get('/owner-only').set('Authorization', `Bearer ${tokenFor('owner')}`)).status).toBe(200);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run api/test/integration/auth.test.ts`
Expected: FAIL — `../../src/middleware/auth` and the login route don't exist.

- [ ] **Step 4: Implement**

`api/src/middleware/auth.ts`:

```ts
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { forbidden, unauthorized } from '../errors';

export interface AuthUser {
  sub: string;
  role: 'owner' | 'worker';
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(unauthorized('Missing token'));
  try {
    req.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
};

export const requireRole = (role: 'owner' | 'worker'): RequestHandler => (req, _res, next) => {
  if (req.user?.role !== role) return next(forbidden());
  next();
};
```

`api/src/routes/auth.ts`:

```ts
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../db';
import { unauthorized } from '../errors';

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);
  const rows = await db().query(
    'SELECT id, name, role, password_hash, is_active FROM users WHERE phone = $1 OR email = $1',
    [identifier],
  );
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw unauthorized('Invalid credentials');
  }
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.jwtSecret, {
    expiresIn: '12h',
  });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});
```

In `api/src/app.ts`, add above the error handler:

```ts
import { authRouter } from './routes/auth';
// ...
app.use('/api/auth', authRouter);
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run api/test/integration/auth.test.ts`
Expected: all tests PASS (requires `DATABASE_URL_TEST` in `.env`).

- [ ] **Step 6: Commit**

```bash
git add api/src api/test
git commit -m "feat: jwt login endpoint, auth middleware, integration test helpers"
```

---

### Task 5: Courts lookup + booking create and list/search with worker clamp

**Files:**
- Create: `api/src/routes/courts.ts`, `api/src/routes/bookings.ts`
- Modify: `api/src/app.ts` (mount both routers)
- Test: `api/test/integration/bookings-create-list.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `db()`, `istDateDaysAgo`, `PHONE_RE`, `DATE_RE`, test helpers.
- Produces:
  - `GET /api/courts` (any authenticated) → `[{ id, venue_id, name }]` for active courts.
  - `POST /api/bookings` (owner) → 201 with the booking row.
  - `GET /api/bookings?date=&from=&to=&status=&q=` (both; worker clamped) → array of bookings each including `total_due`, `total_paid`, `balance_due` (strings) from the view.
  - Exported constant `BOOKING_COLS` (SQL select-list where `booking_date` is cast `::text`) reused by Tasks 6–10.
  - Exported `createSchema` reused by Task 6's edit schema.

- [ ] **Step 1: Write the failing tests**

`api/test/integration/bookings-create-list.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, insertBookingAt, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
});

beforeEach(async () => {
  await db().query('TRUNCATE bookings CASCADE');
});

describe('GET /api/courts', () => {
  it('lists the seeded court for any authenticated user', async () => {
    const res = await request(app).get('/api/courts').set('Authorization', `Bearer ${worker.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Court 1');
  });

  it('401 without a token', async () => {
    expect((await request(app).get('/api/courts')).status).toBe(401);
  });
});

describe('POST /api/bookings', () => {
  it('owner creates a booking (201, status confirmed)', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(bookingPayload(court));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.customer_name).toBe('Test Customer');
    expect(res.body.booking_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('worker cannot create (403)', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${worker.token}`)
      .send(bookingPayload(court));
    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(bookingPayload(court, { customer_name: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects end_time <= start_time with 400', async () => {
    const p = bookingPayload(court);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...p, end_time: p.start_time });
    expect(res.status).toBe(400);
  });

  it('returns the clean 409 on an overlapping slot', async () => {
    const p = bookingPayload(court);
    await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(p);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...p, customer_name: 'Second Group' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This time slot overlaps an existing booking on this court.');
  });

  it('allows rebooking a cancelled slot', async () => {
    const p = bookingPayload(court);
    const first = await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(p);
    await db().query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [first.body.id]);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...p, customer_name: 'Replacement Group' });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/bookings', () => {
  it('filters by status and by name/phone search, and includes balance columns', async () => {
    const a = bookingPayload(court, { customer_name: 'Ravi Patel', customer_phone: '9111111111' });
    const later = new Date(Date.now() + 30 * 3_600_000);
    const b = bookingPayload(court, {
      customer_name: 'Suresh Shah',
      customer_phone: '9222222222',
      booking_date: later.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: later.toISOString(),
      end_time: new Date(later.getTime() + 2 * 3_600_000).toISOString(),
    });
    await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(a);
    await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(b);

    const byName = await request(app).get('/api/bookings?q=ravi').set('Authorization', `Bearer ${owner.token}`);
    expect(byName.body).toHaveLength(1);
    expect(byName.body[0].customer_name).toBe('Ravi Patel');
    expect(byName.body[0].balance_due).toBeDefined();

    const byPhone = await request(app).get('/api/bookings?q=9222').set('Authorization', `Bearer ${owner.token}`);
    expect(byPhone.body).toHaveLength(1);

    const confirmed = await request(app).get('/api/bookings?status=confirmed').set('Authorization', `Bearer ${owner.token}`);
    expect(confirmed.body).toHaveLength(2);
  });

  it('clamps worker results to the last 7 days, owner sees everything', async () => {
    await insertBookingAt(court, -10, owner.id); // 10 days ago — outside worker window
    await insertBookingAt(court, -2, owner.id);  // 2 days ago — inside window
    const workerList = await request(app).get('/api/bookings').set('Authorization', `Bearer ${worker.token}`);
    expect(workerList.body).toHaveLength(1);
    const ownerList = await request(app).get('/api/bookings?from=2000-01-01').set('Authorization', `Bearer ${owner.token}`);
    expect(ownerList.body).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/integration/bookings-create-list.test.ts`
Expected: FAIL — routers don't exist.

- [ ] **Step 3: Implement**

`api/src/routes/courts.ts`:

```ts
import { Router } from 'express';
import { db } from '../db';

export const courtsRouter = Router();

courtsRouter.get('/', async (_req, res) => {
  const rows = await db().query('SELECT id, venue_id, name FROM courts WHERE is_active ORDER BY name');
  res.json(rows);
});
```

`api/src/routes/bookings.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireRole } from '../middleware/auth';
import { istDateDaysAgo } from '../time';
import { DATE_RE, PHONE_RE } from '../validation';

/** Select-list for booking rows. booking_date is cast to text so it is always
 *  a plain 'YYYY-MM-DD' string in JSON, never a driver-parsed Date. */
export const BOOKING_COLS = `bookings.id, court_id, customer_name, customer_phone,
  booking_date::text AS booking_date, start_time, end_time, total_amount, status,
  advance_forfeited, cancellation_reason, reminder_acknowledged, created_at, updated_at`;

export const createSchema = z.object({
  court_id: z.string().uuid(),
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: z.string().regex(PHONE_RE),
  booking_date: z.string().regex(DATE_RE),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  total_amount: z.number().positive(),
}).refine((b) => new Date(b.end_time) > new Date(b.start_time), {
  message: 'end_time must be after start_time',
  path: ['end_time'],
});

const listSchema = z.object({
  date: z.string().regex(DATE_RE).optional(),
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
  status: z.enum(['confirmed', 'arrived', 'completed', 'cancelled', 'no_show']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const bookingsRouter = Router();

bookingsRouter.post('/', requireRole('owner'), async (req, res) => {
  const b = createSchema.parse(req.body);
  const rows = await db().query(
    `INSERT INTO bookings (court_id, customer_name, customer_phone, booking_date, start_time, end_time, total_amount, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${BOOKING_COLS}`,
    [b.court_id, b.customer_name, b.customer_phone, b.booking_date, b.start_time, b.end_time, b.total_amount, req.user!.sub],
  );
  res.status(201).json(rows[0]);
});

bookingsRouter.get('/', async (req, res) => {
  const f = listSchema.parse(req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replaceAll('?', `$${params.length}`));
  };
  if (f.date) add('booking_date = ?::date', f.date);
  if (f.from) add('booking_date >= ?::date', f.from);
  if (f.to) add('booking_date <= ?::date', f.to);
  if (f.status) add('status = ?', f.status);
  if (f.q) add(`(customer_name ILIKE '%' || ? || '%' OR customer_phone ILIKE '%' || ? || '%')`, f.q);
  if (req.user!.role === 'worker') add('booking_date >= ?::date', istDateDaysAgo(7));

  const sql = `
    SELECT ${BOOKING_COLS}, v.total_due, v.total_paid, v.balance_due
    FROM bookings JOIN booking_balances v ON v.booking_id = bookings.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY start_time`;
  res.json(await db().query(sql, params));
});
```

Note: `add()` replaces **all** `?` in a clause with the same numbered parameter, so the `q` clause reuses one parameter for both name and phone.

In `api/src/app.ts`, add above the error handler:

```ts
import { requireAuth } from './middleware/auth';
import { bookingsRouter } from './routes/bookings';
import { courtsRouter } from './routes/courts';
// ...
app.use('/api/courts', requireAuth, courtsRouter);
app.use('/api/bookings', requireAuth, bookingsRouter);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/integration/bookings-create-list.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: courts lookup, booking create with overlap 409, list/search with worker clamp"
```

---

### Task 6: Booking detail and owner edit

**Files:**
- Modify: `api/src/routes/bookings.ts`
- Test: `api/test/integration/bookings-detail-edit.test.ts`

**Interfaces:**
- Consumes: `BOOKING_COLS`, `createSchema`, `istDateDaysAgo`, `todayIST`, helpers.
- Produces:
  - `GET /api/bookings/:id` (both; worker limited to visibility window) → booking + `total_due`/`total_paid`/`balance_due` + `payments: []` + `items: []`.
  - `PATCH /api/bookings/:id` (owner) — partial edit of `court_id`, `customer_name`, `customer_phone`, `booking_date`, `start_time`, `end_time`, `total_amount`; sets `updated_by`/`updated_at`; overlap → 409, `end<=start` → 400 (DB check via middleware).

- [ ] **Step 1: Write the failing tests**

`api/test/integration/bookings-detail-edit.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, insertBookingAt, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
});

beforeEach(async () => {
  await db().query('TRUNCATE bookings CASCADE');
});

async function createBooking(overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court, overrides));
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('GET /api/bookings/:id', () => {
  it('returns detail with empty payments/items and balance equal to total', async () => {
    const id = await createBooking();
    const res = await request(app).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.payments).toEqual([]);
    expect(res.body.items).toEqual([]);
    expect(Number(res.body.balance_due)).toBe(1000);
    expect(res.body.worker_visible).toBeUndefined();
  });

  it('404 for an unknown id and for a malformed id', async () => {
    const unknown = await request(app)
      .get('/api/bookings/00000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(unknown.status).toBe(404);
    const malformed = await request(app).get('/api/bookings/not-a-uuid').set('Authorization', `Bearer ${owner.token}`);
    expect(malformed.status).toBe(404);
  });

  it('worker gets 403 outside the 7-day visibility window', async () => {
    const oldId = await insertBookingAt(court, -10, owner.id);
    const res = await request(app).get(`/api/bookings/${oldId}`).set('Authorization', `Bearer ${worker.token}`);
    expect(res.status).toBe(403);
    const ownerRes = await request(app).get(`/api/bookings/${oldId}`).set('Authorization', `Bearer ${owner.token}`);
    expect(ownerRes.status).toBe(200);
  });
});

describe('PATCH /api/bookings/:id', () => {
  it('owner edits details and updated_at changes', async () => {
    const id = await createBooking();
    const res = await request(app).patch(`/api/bookings/${id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ customer_name: 'Renamed Group', total_amount: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.customer_name).toBe('Renamed Group');
    expect(Number(res.body.total_amount)).toBe(1500);
    expect(res.body.updated_at).not.toBe(res.body.created_at);
  });

  it('moving times onto another booking returns the clean 409', async () => {
    const p1 = bookingPayload(court);
    await createBooking();
    const later = new Date(Date.now() + 30 * 3_600_000);
    const id2 = await createBooking({
      booking_date: later.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: later.toISOString(),
      end_time: new Date(later.getTime() + 2 * 3_600_000).toISOString(),
    });
    const res = await request(app).patch(`/api/bookings/${id2}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ start_time: p1.start_time, end_time: p1.end_time });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This time slot overlaps an existing booking on this court.');
  });

  it('worker cannot edit (403), empty patch is 400', async () => {
    const id = await createBooking();
    const forbidden = await request(app).patch(`/api/bookings/${id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ customer_name: 'Nope' });
    expect(forbidden.status).toBe(403);
    const empty = await request(app).patch(`/api/bookings/${id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({});
    expect(empty.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/integration/bookings-detail-edit.test.ts`
Expected: FAIL — 404s from Express (routes missing).

- [ ] **Step 3: Implement — add to `api/src/routes/bookings.ts`**

Add imports at the top:

```ts
import { forbidden, notFound } from '../errors';
import { istDateDaysAgo } from '../time'; // already imported — extend the existing import
```

Add below the list route:

```ts
const editSchema = z.object({
  court_id: z.string().uuid(),
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: z.string().regex(PHONE_RE),
  booking_date: z.string().regex(DATE_RE),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  total_amount: z.number().positive(),
}).partial().refine((p) => Object.keys(p).length > 0, { message: 'No fields to update' });

bookingsRouter.get('/:id', async (req, res) => {
  const rows = await db().query(
    `SELECT ${BOOKING_COLS}, v.total_due, v.total_paid, v.balance_due,
            booking_date >= $2::date AS worker_visible
     FROM bookings JOIN booking_balances v ON v.booking_id = bookings.id
     WHERE bookings.id = $1`,
    [req.params.id, istDateDaysAgo(7)],
  );
  const row = rows[0];
  if (!row) throw notFound('Booking not found');
  if (req.user!.role === 'worker' && !row.worker_visible) {
    throw forbidden('This booking is outside your visibility window');
  }
  const payments = await db().query(
    'SELECT id, booking_id, amount, type, method, collected_by, paid_at FROM payments WHERE booking_id = $1 ORDER BY paid_at',
    [req.params.id],
  );
  const items = await db().query(
    'SELECT id, booking_id, item_name, quantity, unit_price, total_price, added_by, added_at FROM booking_items WHERE booking_id = $1 ORDER BY added_at',
    [req.params.id],
  );
  const { worker_visible, ...booking } = row;
  res.json({ ...booking, payments, items });
});

bookingsRouter.patch('/:id', requireRole('owner'), async (req, res) => {
  const patch = editSchema.parse(req.body);
  const entries = Object.entries(patch);
  const set = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
  const rows = await db().query(
    `UPDATE bookings SET ${set}, updated_by = $${entries.length + 2}, updated_at = now()
     WHERE id = $1 RETURNING ${BOOKING_COLS}`,
    [req.params.id, ...entries.map(([, v]) => v), req.user!.sub],
  );
  if (!rows[0]) throw notFound('Booking not found');
  res.json(rows[0]);
});
```

`set` interpolates only Zod-validated **key names** (never values) — no injection surface. Route order matters: keep `/:id` routes **after** the literal routes added in later tasks, or register literal routes first; Express matches in registration order.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/integration/bookings-detail-edit.test.ts`
Expected: all tests PASS. Re-run the Task 5 file too — still green.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: booking detail with balances and owner partial edit"
```

---

### Task 7: Status transitions (arrive, complete, cancel, no-show)

**Files:**
- Modify: `api/src/routes/bookings.ts`
- Test: `api/test/integration/bookings-status.test.ts`

**Interfaces:**
- Consumes: `BOOKING_COLS`, `todayIST`, error factories, helpers.
- Produces:
  - `POST /api/bookings/:id/arrive` (both) → `confirmed → arrived`.
  - `POST /api/bookings/:id/complete` (both) → `arrived → completed`.
  - `POST /api/bookings/:id/cancel` (owner) — body `{ reason? }` → `confirmed → cancelled`, `advance_forfeited = TRUE`.
  - `POST /api/bookings/:id/no-show` (both) → `confirmed → no_show`, `advance_forfeited = TRUE`.
  - Exported `loadBookingForAction(req, id)` — 404 if missing, 403 if worker and `booking_date < today` (IST); returns `{ status, actionable }`. Reused by Task 8.

- [ ] **Step 1: Write the failing tests**

`api/test/integration/bookings-status.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, insertBookingAt, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
});

beforeEach(async () => {
  await db().query('TRUNCATE bookings CASCADE');
});

async function createBooking(): Promise<string> {
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court));
  return res.body.id;
}

const act = (id: string, action: string, token: string, body: object = {}) =>
  request(app).post(`/api/bookings/${id}/${action}`).set('Authorization', `Bearer ${token}`).send(body);

describe('status transitions', () => {
  it('worker walks confirmed → arrived → completed', async () => {
    const id = await createBooking();
    expect((await act(id, 'arrive', worker.token)).body.status).toBe('arrived');
    expect((await act(id, 'complete', worker.token)).body.status).toBe('completed');
  });

  it('completing a confirmed booking is 422', async () => {
    const id = await createBooking();
    const res = await act(id, 'complete', worker.token);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('cancel is owner-only, records reason, forfeits advance', async () => {
    const id = await createBooking();
    expect((await act(id, 'cancel', worker.token, { reason: 'x' })).status).toBe(403);
    const res = await act(id, 'cancel', owner.token, { reason: 'Customer called off' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.advance_forfeited).toBe(true);
    expect(res.body.cancellation_reason).toBe('Customer called off');
  });

  it('no-show by worker forfeits advance', async () => {
    const id = await createBooking();
    const res = await act(id, 'no-show', worker.token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('no_show');
    expect(res.body.advance_forfeited).toBe(true);
  });

  it('cancelling an already-cancelled booking is 422', async () => {
    const id = await createBooking();
    await act(id, 'cancel', owner.token);
    expect((await act(id, 'cancel', owner.token)).status).toBe(422);
  });

  it('worker cannot act on a past booking; owner can', async () => {
    const oldId = await insertBookingAt(court, -3, owner.id);
    expect((await act(oldId, 'arrive', worker.token)).status).toBe(403);
    expect((await act(oldId, 'arrive', owner.token)).status).toBe(200);
  });

  it('acting on an unknown booking is 404', async () => {
    expect((await act('00000000-0000-0000-0000-000000000001', 'arrive', owner.token)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/integration/bookings-status.test.ts`
Expected: FAIL — action routes missing (Express 404s).

- [ ] **Step 3: Implement — add to `api/src/routes/bookings.ts`**

Extend imports: `invalidTransition` from `../errors`, `todayIST` from `../time`, and `type Request, type Response` from `express`.

Add **above** the `GET /:id` route (literal segments must not be swallowed — Express matches in order, and `/:id/arrive` vs `/:id` don't conflict, but keep action routes grouped here for readability):

```ts
type BookingStatus = 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';

const TRANSITIONS: Record<string, BookingStatus[]> = {
  confirmed: ['arrived', 'cancelled', 'no_show'],
  arrived: ['completed'],
};

const cancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

/** 404 if the booking doesn't exist; 403 if a worker acts outside today/future. */
export async function loadBookingForAction(req: Request, id: string): Promise<{ status: BookingStatus; actionable: boolean }> {
  const rows = await db().query(
    'SELECT status, booking_date >= $2::date AS actionable FROM bookings WHERE id = $1',
    [id, todayIST()],
  );
  const row = rows[0];
  if (!row) throw notFound('Booking not found');
  if (req.user!.role === 'worker' && !row.actionable) {
    throw forbidden('Workers can only act on today or future bookings');
  }
  return row as { status: BookingStatus; actionable: boolean };
}

async function applyTransition(req: Request, res: Response, target: BookingStatus, forfeit: boolean) {
  const current = await loadBookingForAction(req, req.params.id);
  if (!(TRANSITIONS[current.status] ?? []).includes(target)) {
    throw invalidTransition(current.status, target);
  }
  const reason = target === 'cancelled' ? (cancelSchema.parse(req.body ?? {}).reason ?? null) : null;
  const rows = await db().query(
    `UPDATE bookings SET status = $2,
            advance_forfeited = advance_forfeited OR $3,
            cancellation_reason = COALESCE($4, cancellation_reason),
            updated_by = $5, updated_at = now()
     WHERE id = $1 RETURNING ${BOOKING_COLS}`,
    [req.params.id, target, forfeit, reason, req.user!.sub],
  );
  res.json(rows[0]);
}

bookingsRouter.post('/:id/arrive', (req, res) => applyTransition(req, res, 'arrived', false));
bookingsRouter.post('/:id/complete', (req, res) => applyTransition(req, res, 'completed', false));
bookingsRouter.post('/:id/cancel', requireRole('owner'), (req, res) => applyTransition(req, res, 'cancelled', true));
bookingsRouter.post('/:id/no-show', (req, res) => applyTransition(req, res, 'no_show', true));
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/integration/bookings-status.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: booking status transitions with forfeit rule and worker window"
```

---

### Task 8: Payments and extra items (record + owner correction-delete)

**Files:**
- Create: `api/src/routes/payments.ts`, `api/src/routes/items.ts`
- Modify: `api/src/routes/bookings.ts` (sub-resource POSTs), `api/src/app.ts` (mount delete routers)
- Test: `api/test/integration/payments-items.test.ts`

**Interfaces:**
- Consumes: `loadBookingForAction` (Task 7), `db()`, `requireRole`, `notFound`.
- Produces:
  - `POST /api/bookings/:id/payments` (both, worker window) — body `{ amount: number > 0, type: 'advance'|'remaining'|'extra', method: 'cash'|'upi' }` → 201 payment row.
  - `POST /api/bookings/:id/items` (both, worker window) — body `{ item_name, quantity: int ≥ 1, unit_price: number ≥ 0 }` → 201 item row (includes generated `total_price`).
  - `DELETE /api/payments/:id` (owner) → `{ deleted: id }`.
  - `DELETE /api/items/:id` (owner) → `{ deleted: id }`.

- [ ] **Step 1: Write the failing tests**

`api/test/integration/payments-items.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, insertBookingAt, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
});

beforeEach(async () => {
  await db().query('TRUNCATE bookings CASCADE');
});

async function createBooking(): Promise<string> {
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court));
  return res.body.id;
}

describe('payments and items', () => {
  it('worker records a payment and an item; balance math matches the view', async () => {
    const id = await createBooking(); // total 1000
    const pay = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ amount: 500, type: 'advance', method: 'upi' });
    expect(pay.status).toBe(201);
    expect(pay.body.method).toBe('upi');

    const item = await request(app).post(`/api/bookings/${id}/items`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ item_name: 'Water bottle', quantity: 2, unit_price: 20 });
    expect(item.status).toBe(201);
    expect(Number(item.body.total_price)).toBe(40);

    const detail = await request(app).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(Number(detail.body.total_due)).toBe(1040);
    expect(Number(detail.body.total_paid)).toBe(500);
    expect(Number(detail.body.balance_due)).toBe(540);
    expect(detail.body.payments).toHaveLength(1);
    expect(detail.body.items).toHaveLength(1);
  });

  it('rejects non-V1 payment methods and bad amounts with 400', async () => {
    const id = await createBooking();
    const card = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 100, type: 'advance', method: 'card' });
    expect(card.status).toBe(400);
    const zero = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 0, type: 'advance', method: 'cash' });
    expect(zero.status).toBe(400);
    const badQty = await request(app).post(`/api/bookings/${id}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ item_name: 'Snack', quantity: 0, unit_price: 10 });
    expect(badQty.status).toBe(400);
  });

  it('worker cannot pay against a past booking (403)', async () => {
    const oldId = await insertBookingAt(court, -3, owner.id);
    const res = await request(app).post(`/api/bookings/${oldId}/payments`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ amount: 100, type: 'remaining', method: 'cash' });
    expect(res.status).toBe(403);
  });

  it('owner deletes a mis-entered payment; worker cannot', async () => {
    const id = await createBooking();
    const pay = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 999, type: 'advance', method: 'cash' });
    const denied = await request(app).delete(`/api/payments/${pay.body.id}`).set('Authorization', `Bearer ${worker.token}`);
    expect(denied.status).toBe(403);
    const deleted = await request(app).delete(`/api/payments/${pay.body.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(deleted.status).toBe(200);
    const detail = await request(app).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(Number(detail.body.total_paid)).toBe(0);
    const again = await request(app).delete(`/api/payments/${pay.body.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(again.status).toBe(404);
  });

  it('owner deletes an item; unknown item is 404', async () => {
    const id = await createBooking();
    const item = await request(app).post(`/api/bookings/${id}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ item_name: 'Snacks', quantity: 1, unit_price: 50 });
    const deleted = await request(app).delete(`/api/items/${item.body.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(deleted.status).toBe(200);
    expect((await request(app).delete('/api/items/00000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${owner.token}`)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/integration/payments-items.test.ts`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement**

Add to `api/src/routes/bookings.ts` (below the transition routes):

```ts
const paymentSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['advance', 'remaining', 'extra']),
  method: z.enum(['cash', 'upi']), // V1 accepts only these two (schema enum is wider)
});

const itemSchema = z.object({
  item_name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
});

bookingsRouter.post('/:id/payments', async (req, res) => {
  const p = paymentSchema.parse(req.body);
  await loadBookingForAction(req, req.params.id);
  const rows = await db().query(
    `INSERT INTO payments (booking_id, amount, type, method, collected_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, booking_id, amount, type, method, collected_by, paid_at`,
    [req.params.id, p.amount, p.type, p.method, req.user!.sub],
  );
  res.status(201).json(rows[0]);
});

bookingsRouter.post('/:id/items', async (req, res) => {
  const i = itemSchema.parse(req.body);
  await loadBookingForAction(req, req.params.id);
  const rows = await db().query(
    `INSERT INTO booking_items (booking_id, item_name, quantity, unit_price, added_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, booking_id, item_name, quantity, unit_price, total_price, added_by, added_at`,
    [req.params.id, i.item_name, i.quantity, i.unit_price, req.user!.sub],
  );
  res.status(201).json(rows[0]);
});
```

`api/src/routes/payments.ts`:

```ts
import { Router } from 'express';
import { db } from '../db';
import { notFound } from '../errors';
import { requireRole } from '../middleware/auth';

export const paymentsRouter = Router();

paymentsRouter.delete('/:id', requireRole('owner'), async (req, res) => {
  const rows = await db().query('DELETE FROM payments WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) throw notFound('Payment not found');
  res.json({ deleted: rows[0].id });
});
```

`api/src/routes/items.ts`:

```ts
import { Router } from 'express';
import { db } from '../db';
import { notFound } from '../errors';
import { requireRole } from '../middleware/auth';

export const itemsRouter = Router();

itemsRouter.delete('/:id', requireRole('owner'), async (req, res) => {
  const rows = await db().query('DELETE FROM booking_items WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) throw notFound('Item not found');
  res.json({ deleted: rows[0].id });
});
```

In `api/src/app.ts`, add above the error handler:

```ts
import { itemsRouter } from './routes/items';
import { paymentsRouter } from './routes/payments';
// ...
app.use('/api/payments', requireAuth, paymentsRouter);
app.use('/api/items', requireAuth, itemsRouter);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/integration/payments-items.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: payment and extra-item recording with owner correction deletes"
```

---

### Task 9: Worker reminders (polled query + acknowledge)

**Files:**
- Create: `api/src/routes/reminders.ts`
- Modify: `api/src/app.ts` (mount)
- Test: `api/test/integration/reminders.test.ts`

**Interfaces:**
- Consumes: `BOOKING_COLS`, `db()`, `requireRole`, `notFound`, helpers.
- Produces:
  - `GET /api/reminders` (worker) → bookings where `status = 'confirmed' AND start_time BETWEEN now() AND now() + interval '30 minutes' AND NOT reminder_acknowledged`, ordered by `start_time`.
  - `POST /api/reminders/:bookingId/ack` (worker) → sets `reminder_acknowledged = TRUE`, returns `{ ok: true }`.

- [ ] **Step 1: Write the failing tests**

`api/test/integration/reminders.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
});

beforeEach(async () => {
  await db().query('TRUNCATE bookings CASCADE');
});

async function createStartingInMinutes(minutes: number): Promise<string> {
  const start = new Date(Date.now() + minutes * 60_000);
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court, {
      booking_date: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    }));
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('GET /api/reminders', () => {
  it('shows a confirmed booking starting in 15 minutes, not one 3 hours out', async () => {
    const soonId = await createStartingInMinutes(15);
    await createStartingInMinutes(180);
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(soonId);
  });

  it('is worker-only (owner gets 403)', async () => {
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });

  it('acknowledged reminders disappear; unknown booking ack is 404', async () => {
    const id = await createStartingInMinutes(20);
    const ack = await request(app).post(`/api/reminders/${id}/ack`).set('Authorization', `Bearer ${worker.token}`);
    expect(ack.status).toBe(200);
    expect(ack.body).toEqual({ ok: true });
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(0);
    expect((await request(app).post('/api/reminders/00000000-0000-0000-0000-000000000001/ack')
      .set('Authorization', `Bearer ${worker.token}`)).status).toBe(404);
  });

  it('an arrived booking no longer reminds', async () => {
    const id = await createStartingInMinutes(15);
    await request(app).post(`/api/bookings/${id}/arrive`).set('Authorization', `Bearer ${worker.token}`);
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/integration/reminders.test.ts`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement**

`api/src/routes/reminders.ts`:

```ts
import { Router } from 'express';
import { db } from '../db';
import { notFound } from '../errors';
import { requireRole } from '../middleware/auth';
import { BOOKING_COLS } from './bookings';

export const remindersRouter = Router();

remindersRouter.get('/', requireRole('worker'), async (_req, res) => {
  const rows = await db().query(
    `SELECT ${BOOKING_COLS} FROM bookings
     WHERE status = 'confirmed'
       AND start_time BETWEEN now() AND now() + interval '30 minutes'
       AND NOT reminder_acknowledged
     ORDER BY start_time`,
  );
  res.json(rows);
});

remindersRouter.post('/:bookingId/ack', requireRole('worker'), async (req, res) => {
  const rows = await db().query(
    'UPDATE bookings SET reminder_acknowledged = TRUE WHERE id = $1 RETURNING id',
    [req.params.bookingId],
  );
  if (!rows[0]) throw notFound('Booking not found');
  res.json({ ok: true });
});
```

In `api/src/app.ts`:

```ts
import { remindersRouter } from './routes/reminders';
// ...
app.use('/api/reminders', requireAuth, remindersRouter);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/integration/reminders.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: worker reminder query and acknowledgment"
```

---

### Task 10: Owner reports (summary, pending payments, trends)

**Files:**
- Create: `api/src/routes/reports.ts`
- Modify: `api/src/app.ts` (mount, owner-only)
- Test: `api/test/integration/reports.test.ts`

**Interfaces:**
- Consumes: `BOOKING_COLS`, `db()`, `DATE_RE`, helpers.
- Produces (all owner-only; `from`/`to` are `YYYY-MM-DD`, `from <= to`, dates in IST):
  - `GET /api/reports/summary?from=&to=` → `{ revenue: string, forfeited_advances: string, bookings: { [status]: count } }`.
  - `GET /api/reports/pending` → bookings (with balance columns) where `status NOT IN ('cancelled','no_show')` and `balance_due > 0`.
  - `GET /api/reports/trends?from=&to=` → `[{ day: 'YYYY-MM-DD', bookings: number, revenue: string }]` sorted by day.

- [ ] **Step 1: Write the failing tests**

`api/test/integration/reports.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;
const WIDE = 'from=2000-01-01&to=2100-01-01';

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
  await db().query('TRUNCATE bookings CASCADE');

  // Booking A: total 1000, paid 400 advance → pending 600
  const a = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court));
  await request(app).post(`/api/bookings/${a.body.id}/payments`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ amount: 400, type: 'advance', method: 'cash' });

  // Booking B: tomorrow, paid 300 advance, then cancelled → forfeited 300
  const t = new Date(Date.now() + 26 * 3_600_000);
  const b = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court, {
      booking_date: t.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: t.toISOString(),
      end_time: new Date(t.getTime() + 2 * 3_600_000).toISOString(),
    }));
  await request(app).post(`/api/bookings/${b.body.id}/payments`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ amount: 300, type: 'advance', method: 'upi' });
  await request(app).post(`/api/bookings/${b.body.id}/cancel`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ reason: 'rain' });
});

describe('reports', () => {
  it('summary aggregates revenue, forfeits, and status counts', async () => {
    const res = await request(app).get(`/api/reports/summary?${WIDE}`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.revenue)).toBe(700);              // 400 + 300 collected
    expect(Number(res.body.forfeited_advances)).toBe(300);   // B's advance
    expect(res.body.bookings.confirmed).toBe(1);
    expect(res.body.bookings.cancelled).toBe(1);
  });

  it('pending lists only live bookings with balance due', async () => {
    const res = await request(app).get('/api/reports/pending').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1); // A only — B is cancelled despite balance
    expect(Number(res.body[0].balance_due)).toBe(600);
  });

  it('trends returns one row per day with bookings and revenue', async () => {
    const res = await request(app).get(`/api/reports/trends?${WIDE}`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    const total = res.body.reduce((s: number, r: { bookings: number }) => s + r.bookings, 0);
    expect(total).toBe(2);
    const revenue = res.body.reduce((s: number, r: { revenue: string }) => s + Number(r.revenue), 0);
    expect(revenue).toBe(700);
    expect(res.body[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is owner-only and validates the range', async () => {
    expect((await request(app).get(`/api/reports/summary?${WIDE}`)
      .set('Authorization', `Bearer ${worker.token}`)).status).toBe(403);
    expect((await request(app).get('/api/reports/summary?from=2026-02-01&to=2026-01-01')
      .set('Authorization', `Bearer ${owner.token}`)).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/integration/reports.test.ts`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement**

`api/src/routes/reports.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { DATE_RE } from '../validation';
import { BOOKING_COLS } from './bookings';

const rangeSchema = z.object({
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
}).refine((r) => r.from <= r.to, { message: 'from must be on or before to' });

export const reportsRouter = Router();

reportsRouter.get('/summary', async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const [rev] = await db().query(
    `SELECT COALESCE(SUM(amount), 0)::text AS revenue
     FROM payments
     WHERE (paid_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1 AND $2`,
    [from, to],
  );
  const [forf] = await db().query(
    `SELECT COALESCE(SUM(p.amount), 0)::text AS forfeited
     FROM payments p JOIN bookings b ON b.id = p.booking_id
     WHERE b.advance_forfeited AND p.type = 'advance' AND b.booking_date BETWEEN $1 AND $2`,
    [from, to],
  );
  const counts = await db().query(
    `SELECT status::text AS status, COUNT(*)::int AS count
     FROM bookings WHERE booking_date BETWEEN $1 AND $2 GROUP BY status`,
    [from, to],
  );
  res.json({
    revenue: rev.revenue,
    forfeited_advances: forf.forfeited,
    bookings: Object.fromEntries((counts as { status: string; count: number }[]).map((c) => [c.status, c.count])),
  });
});

reportsRouter.get('/pending', async (_req, res) => {
  const rows = await db().query(
    `SELECT ${BOOKING_COLS}, v.total_due, v.total_paid, v.balance_due
     FROM bookings JOIN booking_balances v ON v.booking_id = bookings.id
     WHERE status NOT IN ('cancelled', 'no_show') AND v.balance_due > 0
     ORDER BY booking_date, start_time`,
  );
  res.json(rows);
});

reportsRouter.get('/trends', async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const byDay = await db().query(
    `SELECT booking_date::text AS day, COUNT(*)::int AS bookings
     FROM bookings WHERE booking_date BETWEEN $1 AND $2 GROUP BY booking_date`,
    [from, to],
  );
  const revByDay = await db().query(
    `SELECT ((paid_at AT TIME ZONE 'Asia/Kolkata')::date)::text AS day, SUM(amount)::text AS revenue
     FROM payments WHERE (paid_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1 AND $2 GROUP BY 1`,
    [from, to],
  );
  const days = new Map<string, { day: string; bookings: number; revenue: string }>();
  for (const r of byDay as { day: string; bookings: number }[]) {
    days.set(r.day, { day: r.day, bookings: r.bookings, revenue: '0' });
  }
  for (const r of revByDay as { day: string; revenue: string }[]) {
    const entry = days.get(r.day) ?? { day: r.day, bookings: 0, revenue: '0' };
    entry.revenue = r.revenue;
    days.set(r.day, entry);
  }
  res.json([...days.values()].sort((a, b) => a.day.localeCompare(b.day)));
});
```

In `api/src/app.ts`:

```ts
import { requireRole } from './middleware/auth'; // extend the existing import
import { reportsRouter } from './routes/reports';
// ...
app.use('/api/reports', requireAuth, requireRole('owner'), reportsRouter);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/integration/reports.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: owner reports - summary, pending payments, daily trends"
```

---

### Task 11: User management (view worker, update worker/own password)

**Files:**
- Create: `api/src/routes/users.ts`
- Modify: `api/src/app.ts` (mount)
- Test: `api/test/integration/users.test.ts`

**Interfaces:**
- Consumes: `db()`, `requireRole`, `PHONE_RE`, error factories, helpers.
- Produces:
  - `GET /api/users/worker` (owner) → `{ id, name, phone, email, role, is_active }` of the worker account.
  - `PATCH /api/users/:id` — owner may update the worker account (`name`, `phone`, `email`, `password`, `is_active`) or their own record; worker may update **only their own `password`**. Password is bcrypt-hashed (cost 10). Returns the row sans hash.

- [ ] **Step 1: Write the failing tests**

`api/test/integration/users.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
});

describe('user management', () => {
  it('owner views the worker account without the password hash', async () => {
    const res = await request(app).get('/api/users/worker').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('worker');
    expect(res.body.password_hash).toBeUndefined();
    expect((await request(app).get('/api/users/worker')
      .set('Authorization', `Bearer ${worker.token}`)).status).toBe(403);
  });

  it('owner updates the worker name and deactivates the account; login then fails', async () => {
    const res = await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'New Worker Name', is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Worker Name');
    const login = await request(app).post('/api/auth/login')
      .send({ identifier: '9000000002', password: 'password123' });
    expect(login.status).toBe(401);
    await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ is_active: true });
  });

  it('worker changes own password and can log in with it', async () => {
    const res = await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ password: 'newpassword9' });
    expect(res.status).toBe(200);
    const login = await request(app).post('/api/auth/login')
      .send({ identifier: '9000000002', password: 'newpassword9' });
    expect(login.status).toBe(200);
  });

  it('worker cannot change own name or anyone else', async () => {
    expect((await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ name: 'Sneaky' })).status).toBe(403);
    expect((await request(app).patch(`/api/users/${owner.id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ password: 'hacked12345' })).status).toBe(403);
  });

  it('owner changes own password; short passwords and empty patches are 400', async () => {
    const ok = await request(app).patch(`/api/users/${owner.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ password: 'ownerpass99' });
    expect(ok.status).toBe(200);
    expect((await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ password: 'short' })).status).toBe(400);
    expect((await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/test/integration/users.test.ts`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement**

`api/src/routes/users.ts`:

```ts
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { forbidden, notFound } from '../errors';
import { requireRole } from '../middleware/auth';
import { PHONE_RE } from '../validation';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().regex(PHONE_RE).optional(),
  email: z.string().email().max(150).nullable().optional(),
  password: z.string().min(8).max(100).optional(),
  is_active: z.boolean().optional(),
}).refine((p) => Object.keys(p).length > 0, { message: 'No fields to update' });

const SAFE_COLS = 'id, name, phone, email, role, is_active';

export const usersRouter = Router();

usersRouter.get('/worker', requireRole('owner'), async (_req, res) => {
  const rows = await db().query(`SELECT ${SAFE_COLS} FROM users WHERE role = 'worker' LIMIT 1`);
  if (!rows[0]) throw notFound('Worker account not found');
  res.json(rows[0]);
});

usersRouter.patch('/:id', async (req, res) => {
  const patch = updateSchema.parse(req.body);
  const isSelf = req.params.id === req.user!.sub;

  if (req.user!.role === 'worker') {
    if (!isSelf || Object.keys(patch).some((k) => k !== 'password')) {
      throw forbidden('Workers may only change their own password');
    }
  } else if (!isSelf) {
    const rows = await db().query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('User not found');
    if (rows[0].role !== 'worker') throw forbidden('Only the worker account can be managed');
  }

  const cols: Record<string, unknown> = { ...patch };
  if (typeof cols.password === 'string') {
    cols.password_hash = await bcrypt.hash(cols.password, 10);
    delete cols.password;
  }
  const entries = Object.entries(cols);
  const set = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
  const rows = await db().query(
    `UPDATE users SET ${set}, updated_at = now() WHERE id = $1 RETURNING ${SAFE_COLS}`,
    [req.params.id, ...entries.map(([, v]) => v)],
  );
  if (!rows[0]) throw notFound('User not found');
  res.json(rows[0]);
});
```

In `api/src/app.ts`:

```ts
import { usersRouter } from './routes/users';
// ...
app.use('/api/users', requireAuth, usersRouter);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/test/integration/users.test.ts`
Expected: all tests PASS. Then run the whole suite: `npm run test:api` — everything green.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat: worker account management and password changes"
```

---

### Task 12: Seed script, Vercel entry point, local dev server, smoke test

**Files:**
- Create: `db/seed-users.ts`, `api/index.ts`, `api/local-dev.ts`, `vercel.json`

**Interfaces:**
- Consumes: the finished `app` (Tasks 3–11).
- Produces: `api/index.ts` default-exports the Express app (Vercel builds it as the single `/api` function); `npm run dev:api` serves it on port 3000; `npm run seed:users` creates/updates the two accounts.

- [ ] **Step 1: Write `db/seed-users.ts`**

```ts
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} — usage:
  OWNER_NAME=.. OWNER_PHONE=.. OWNER_PASSWORD=.. WORKER_NAME=.. WORKER_PHONE=.. WORKER_PASSWORD=.. npm run seed:users`);
  return value;
}

const sql = neon(required('DATABASE_URL'));

async function upsertUser(role: 'owner' | 'worker', name: string, phone: string, email: string | null, password: string) {
  const hash = await bcrypt.hash(password, 10);
  await sql.query(
    `INSERT INTO users (name, phone, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (phone) DO UPDATE
       SET name = EXCLUDED.name, email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash, is_active = TRUE, updated_at = now()`,
    [name, phone, email, hash, role],
  );
  console.log(`Seeded ${role}: ${name} (${phone})`);
}

await upsertUser('owner', required('OWNER_NAME'), required('OWNER_PHONE'), process.env.OWNER_EMAIL ?? null, required('OWNER_PASSWORD'));
await upsertUser('worker', required('WORKER_NAME'), required('WORKER_PHONE'), process.env.WORKER_EMAIL ?? null, required('WORKER_PASSWORD'));
```

- [ ] **Step 2: Write `api/index.ts`** (Vercel function entry)

```ts
import { app } from './src/app';

export default app;
```

- [ ] **Step 3: Write `api/local-dev.ts`**

```ts
import 'dotenv/config';

const { app } = await import('./src/app');

app.listen(3000, () => {
  console.log('API listening on http://localhost:3000');
});
```

(dotenv loads before the dynamic import so `config` getters see the env.)

- [ ] **Step 4: Write `vercel.json`** (backend-only version; the frontend plan extends it)

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" }
  ]
}
```

- [ ] **Step 5: Seed dev users and smoke-test locally**

```bash
OWNER_NAME="Owner" OWNER_PHONE="9100000001" OWNER_PASSWORD="owner-dev-pass" \
WORKER_NAME="Worker" WORKER_PHONE="9100000002" WORKER_PASSWORD="worker-dev-pass" \
npm run seed:users
```

Expected: `Seeded owner: ...` and `Seeded worker: ...`.

Start the server (`npm run dev:api`), then in another shell:

```bash
curl -s http://localhost:3000/api/health
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"9100000001","password":"owner-dev-pass"}'
```

Expected: `{"ok":true}` and a JSON body containing `"token"` and `"user"`. Stop the server.

- [ ] **Step 6: Full verification**

Run: `npm run test:api && npm run typecheck`
Expected: entire suite passes, no type errors.

- [ ] **Step 7: Commit**

```bash
git add db/seed-users.ts api/index.ts api/local-dev.ts vercel.json
git commit -m "feat: account seed script, vercel serverless entry, local dev server"
```

---

## Done — backend complete

All spec §7 endpoints exist with tests against the real Neon constraint and view. Continue with `docs/superpowers/plans/2026-07-10-box-cricket-v1-frontend.md`.
