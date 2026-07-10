# Box Cricket V1 — Frontend & Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Angular Material SPA (owner + worker screens) on top of the finished backend, wire up single-project Vercel deployment, and write the README.

**Architecture:** Standalone Angular components (no NgModules), one typed API service per resource in `core/`, an interceptor that attaches the JWT and handles 401s, `authGuard`/`roleGuard` route guards mirroring the server rules. Owner and worker share one role-aware booking-detail component. Every screen works on mobile and desktop.

**Tech Stack:** Angular (latest CLI), Angular Material, ng2-charts + Chart.js (trends chart only), RxJS, Jasmine/Karma (as the CLI ships).

**Spec:** `docs/superpowers/specs/2026-07-10-box-cricket-v1-design.md` §5, §8–§10.
**Depends on:** the completed backend plan (`2026-07-10-box-cricket-v1-backend.md`) — the API must exist and its tests pass.

## Global Constraints

- Tech stack locked: Angular SPA (no SSR), Angular Material, Chart.js via ng2-charts — no other UI libraries.
- Standalone components everywhere; no NgModules.
- Components never inject `HttpClient` directly — always through the typed API services in `core/`.
- JWT in `localStorage`, attached by the interceptor; 401 anywhere (except the login call itself) logs out and redirects to `/login`.
- Client-side guards are UX only — the server remains the enforcement (spec §8).
- Money values arrive as **strings** (Postgres NUMERIC). Format with the `inr` pipe; never do arithmetic on them client-side (the API's `balance_due` is the truth).
- Booking form: end time defaults to start + 2 hours, editable; no 2-hour assumption in validation.
- Every screen must be usable on a phone (worker) and desktop (owner): tables get `overflow-x: auto` wrappers or card layouts, dialogs use `maxWidth: '95vw'`.
- Reminder banner: poll `GET /api/reminders` every 60 s; dismiss = `POST /api/reminders/:id/ack`.
- Both users are IST; display times with Angular's `date` pipe (browser-local), compose ISO timestamps from local date+time inputs.
- Frontend tests: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`.

---

### Task 1: Angular workspace, Material, proxy, and dev scripts

**Files:**
- Create: `frontend/` (Angular CLI workspace), `frontend/proxy.conf.json`
- Modify: root `package.json` (dev scripts)

**Interfaces:**
- Produces: `npm run dev` at repo root runs API (:3000) + Angular dev server (:4200, proxying `/api`); `frontend/` builds with `ng build` to `frontend/dist/frontend/browser`.

- [ ] **Step 1: Generate the workspace**

From the repo root:

```bash
npx -y @angular/cli@latest new frontend --directory frontend --style=scss --ssr=false --skip-git --defaults
```

- [ ] **Step 2: Add Material and charts**

```bash
cd frontend
npx ng add @angular/material --skip-confirmation
npm install ng2-charts chart.js
```

If `ng add` prompts for a theme/typography/animations, accept the defaults (any prebuilt theme is fine).

- [ ] **Step 3: Write `frontend/proxy.conf.json`**

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

- [ ] **Step 4: Wire scripts**

In `frontend/package.json`, change the `start` script to:

```json
"start": "ng serve --proxy-config proxy.conf.json"
```

At the repo root: `npm install -D concurrently`, then add to root `package.json` scripts:

```json
"dev": "concurrently -n api,web \"npm run dev:api\" \"npm --prefix frontend run start\""
```

- [ ] **Step 5: Verify build and default test**

```bash
cd frontend && npx ng build
npm test -- --watch=false --browsers=ChromeHeadless
```

Expected: build emits `frontend/dist/frontend/browser/index.html`; the CLI's generated spec passes. If the sandbox has no Chrome, note it and rely on CI/user for test runs — do not delete tests.

- [ ] **Step 6: Commit**

```bash
git add frontend package.json package-lock.json
git commit -m "chore: scaffold angular workspace with material, charts, api proxy"
```

---

### Task 2: Models, AuthService, interceptor, guards, and login screen

**Files:**
- Create: `frontend/src/app/core/models.ts`, `frontend/src/app/core/auth.service.ts`, `frontend/src/app/core/auth.interceptor.ts`, `frontend/src/app/core/guards.ts`, `frontend/src/app/features/login/login.component.ts`
- Modify: `frontend/src/app/app.config.ts`, `frontend/src/app/app.routes.ts`, `frontend/src/app/app.ts` (root component hosts only `<router-outlet/>`)
- Test: `frontend/src/app/core/auth.service.spec.ts`, `frontend/src/app/core/auth.interceptor.spec.ts`, `frontend/src/app/core/guards.spec.ts`

**Interfaces:**
- Consumes: backend `POST /api/auth/login`.
- Produces (used by every later task):
  - Types: `Role`, `BookingStatus`, `AuthUser { id; role; name }`, `LoginResponse`, `Booking`, `BookingDetail`, `Payment`, `BookingItem`, `Court`, `ReportSummary`, `TrendPoint`, `WorkerAccount`, `NewBooking`.
  - `AuthService`: `login(identifier, password): Observable<LoginResponse>` (stores token), `get token(): string | null`, `get user(): AuthUser | null` (null when absent/expired), `logout(): void` (clears + navigates to `/login`), `homeFor(role): string`.
  - `authInterceptor: HttpInterceptorFn`, `authGuard: CanActivateFn`, `roleGuard(role): CanActivateFn`.

- [ ] **Step 1: Write `core/models.ts`**

```ts
export type Role = 'owner' | 'worker';
export type BookingStatus = 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';
export type PaymentType = 'advance' | 'remaining' | 'extra';
export type PaymentMethod = 'cash' | 'upi';

export interface AuthUser { id: string; role: Role; name: string; }
export interface LoginResponse { token: string; user: { id: string; name: string; role: Role }; }
export interface Court { id: string; venue_id: string; name: string; }

export interface Booking {
  id: string;
  court_id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string;          // YYYY-MM-DD
  start_time: string;            // ISO timestamp
  end_time: string;
  total_amount: string;          // NUMERIC → string
  status: BookingStatus;
  advance_forfeited: boolean;
  cancellation_reason: string | null;
  reminder_acknowledged: boolean;
  created_at: string;
  updated_at: string;
  total_due?: string;
  total_paid?: string;
  balance_due?: string;
}

export interface Payment {
  id: string; booking_id: string; amount: string;
  type: PaymentType; method: string; collected_by: string; paid_at: string;
}

export interface BookingItem {
  id: string; booking_id: string; item_name: string;
  quantity: number; unit_price: string; total_price: string; added_by: string; added_at: string;
}

export interface BookingDetail extends Booking {
  payments: Payment[];
  items: BookingItem[];
}

export interface NewBooking {
  court_id: string; customer_name: string; customer_phone: string;
  booking_date: string; start_time: string; end_time: string; total_amount: number;
}

export interface ReportSummary {
  revenue: string;
  forfeited_advances: string;
  bookings: Partial<Record<BookingStatus, number>>;
}

export interface TrendPoint { day: string; bookings: number; revenue: string; }

export interface WorkerAccount {
  id: string; name: string; phone: string; email: string | null; role: Role; is_active: boolean;
}
```

- [ ] **Step 2: Write the failing tests**

`frontend/src/app/core/auth.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

export function fakeJwt(payload: object, expiresInSec = 3600): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  return ['header', btoa(JSON.stringify(body)), 'sig'].join('.');
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    localStorage.clear();
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); localStorage.clear(); });

  it('login POSTs credentials and stores the token', () => {
    service.login('9000000001', 'pw').subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ identifier: '9000000001', password: 'pw' });
    const token = fakeJwt({ sub: 'u1', role: 'owner', name: 'O' });
    req.flush({ token, user: { id: 'u1', name: 'O', role: 'owner' } });
    expect(service.token).toBe(token);
    expect(service.user?.role).toBe('owner');
  });

  it('user is null with no token, an expired token, or garbage', () => {
    expect(service.user).toBeNull();
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }, -60));
    expect(service.user).toBeNull();
    localStorage.setItem('token', 'garbage');
    expect(service.user).toBeNull();
  });

  it('logout clears the token', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'worker', name: 'W' }));
    service.logout();
    expect(service.token).toBeNull();
  });

  it('homeFor maps roles to their landing routes', () => {
    expect(service.homeFor('owner')).toBe('/owner/bookings');
    expect(service.homeFor('worker')).toBe('/worker');
  });
});
```

`frontend/src/app/core/auth.interceptor.spec.ts`:

```ts
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { fakeJwt } from './auth.service.spec';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    localStorage.clear();
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { ctrl.verify(); localStorage.clear(); });

  it('attaches Authorization when a token exists', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    http.get('/api/bookings').subscribe();
    const req = ctrl.expectOne('/api/bookings');
    expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
    req.flush([]);
  });

  it('sends no header without a token', () => {
    http.get('/api/courts').subscribe();
    const req = ctrl.expectOne('/api/courts');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });

  it('a 401 clears the token and navigates to /login', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate');
    http.get('/api/bookings').subscribe({ error: () => {} });
    ctrl.expectOne('/api/bookings').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('token')).toBeNull();
    expect(nav).toHaveBeenCalledWith(['/login']);
  });
});
```

`frontend/src/app/core/guards.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { authGuard, roleGuard } from './guards';
import { fakeJwt } from './auth.service.spec';

describe('guards', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    localStorage.clear();
  });

  const run = (fn: () => unknown) => TestBed.runInInjectionContext(fn);

  it('authGuard redirects to /login when logged out', () => {
    const result = run(() => authGuard({} as never, {} as never));
    expect(result instanceof UrlTree && result.toString()).toBe('/login');
  });

  it('authGuard passes when logged in', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    expect(run(() => authGuard({} as never, {} as never))).toBeTrue();
  });

  it('roleGuard sends the wrong role to its own home', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'worker', name: 'W' }));
    const result = run(() => roleGuard('owner')({} as never, {} as never));
    expect(result instanceof UrlTree && result.toString()).toBe('/worker');
  });

  it('roleGuard passes the right role', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    expect(run(() => roleGuard('owner')({} as never, {} as never))).toBeTrue();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `auth.service`, `auth.interceptor`, `guards` don't exist.

- [ ] **Step 4: Implement**

`frontend/src/app/core/auth.service.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthUser, LoginResponse, Role } from './models';

const TOKEN_KEY = 'token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  login(identifier: string, password: string) {
    return this.http
      .post<LoginResponse>('/api/auth/login', { identifier, password })
      .pipe(tap((r) => localStorage.setItem(TOKEN_KEY, r.token)));
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get user(): AuthUser | null {
    const token = this.token;
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
      return { id: payload.sub, role: payload.role, name: payload.name };
    } catch {
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigate(['/login']);
  }

  homeFor(role: Role): string {
    return role === 'owner' ? '/owner/bookings' : '/worker';
  }
}
```

`frontend/src/app/core/auth.interceptor.ts`:

```ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const authedReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authedReq).pipe(
    catchError((err) => {
      if (err.status === 401 && !req.url.endsWith('/auth/login')) auth.logout();
      return throwError(() => err);
    }),
  );
};
```

`frontend/src/app/core/guards.ts`:

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user ? true : inject(Router).createUrlTree(['/login']);
};

export const roleGuard = (role: Role): CanActivateFn => () => {
  const auth = inject(AuthService);
  const user = auth.user;
  if (!user) return inject(Router).createUrlTree(['/login']);
  return user.role === role ? true : inject(Router).createUrlTree([auth.homeFor(user.role)]);
};
```

`frontend/src/app/features/login/login.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="wrap">
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Box Cricket</mat-card-title></mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Phone or email</mat-label>
              <input matInput formControlName="identifier" autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" />
            </mat-form-field>
            <button mat-flat-button type="submit" [disabled]="form.invalid || loading">Sign in</button>
            @if (error) { <p class="error">{{ error }}</p> }
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .wrap { display: flex; justify-content: center; padding: 15vh 16px 0; }
    mat-card { width: 100%; max-width: 360px; }
    form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .error { color: var(--mat-sys-error, #b00020); margin: 8px 0 0; }
  `,
})
export class LoginComponent {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = false;
  error = '';
  form = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { identifier, password } = this.form.getRawValue();
    this.auth.login(identifier, password).subscribe({
      next: (r) => this.router.navigateByUrl(this.auth.homeFor(r.user.role)),
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error?.message ?? 'Login failed';
      },
    });
  }
}
```

In `frontend/src/app/app.config.ts`, ensure the providers include:

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth.interceptor';
// inside providers: [...]
provideHttpClient(withInterceptors([authInterceptor])),
```

(keep the CLI-generated `provideRouter(routes)` and animations provider).

In `frontend/src/app/app.routes.ts` (shell routes arrive in Task 4):

```ts
import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
```

Reduce the root component template (`app.ts` / `app.html`) to just `<router-outlet />` and delete the CLI's placeholder spec assertions about template content (keep a smoke `should create` test).

- [ ] **Step 5: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: all specs PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: auth service, jwt interceptor, route guards, login screen"
```

---

### Task 3: Typed API services

**Files:**
- Create: `frontend/src/app/core/api.ts`
- Test: `frontend/src/app/core/api.spec.ts`

**Interfaces:**
- Consumes: `models.ts`; backend endpoints (backend plan Tasks 5–11).
- Produces injectables used by all screens:
  - `CourtsApi.list(): Observable<Court[]>`
  - `BookingsApi.list(filters?: { date?; from?; to?; status?; q? })`, `.get(id)`, `.create(b: NewBooking)`, `.update(id, patch: Partial<NewBooking>)`, `.arrive(id)`, `.complete(id)`, `.cancel(id, reason?)`, `.noShow(id)`, `.addPayment(id, p: { amount: number; type: PaymentType; method: PaymentMethod })`, `.deletePayment(paymentId)`, `.addItem(id, i: { item_name: string; quantity: number; unit_price: number })`, `.deleteItem(itemId)`
  - `RemindersApi.list(): Observable<Booking[]>`, `.ack(bookingId)`
  - `ReportsApi.summary(from, to)`, `.pending()`, `.trends(from, to)`
  - `UsersApi.worker(): Observable<WorkerAccount>`, `.update(id, patch)`

- [ ] **Step 1: Write the failing tests**

`frontend/src/app/core/api.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BookingsApi, ReportsApi, RemindersApi } from './api';

describe('API services', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('BookingsApi.list sends only the provided filters as params', () => {
    const api = TestBed.inject(BookingsApi);
    api.list({ status: 'confirmed', q: 'ravi' }).subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/bookings');
    expect(req.request.params.get('status')).toBe('confirmed');
    expect(req.request.params.get('q')).toBe('ravi');
    expect(req.request.params.has('date')).toBeFalse();
    req.flush([]);
  });

  it('BookingsApi actions hit the right endpoints', () => {
    const api = TestBed.inject(BookingsApi);
    api.cancel('b1', 'rain').subscribe();
    const cancel = ctrl.expectOne('/api/bookings/b1/cancel');
    expect(cancel.request.method).toBe('POST');
    expect(cancel.request.body).toEqual({ reason: 'rain' });
    cancel.flush({});

    api.addPayment('b1', { amount: 500, type: 'advance', method: 'upi' }).subscribe();
    const pay = ctrl.expectOne('/api/bookings/b1/payments');
    expect(pay.request.body.amount).toBe(500);
    pay.flush({});

    api.deletePayment('p1').subscribe();
    const del = ctrl.expectOne('/api/payments/p1');
    expect(del.request.method).toBe('DELETE');
    del.flush({});
  });

  it('RemindersApi acks by booking id', () => {
    const api = TestBed.inject(RemindersApi);
    api.ack('b9').subscribe();
    const req = ctrl.expectOne('/api/reminders/b9/ack');
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
  });

  it('ReportsApi passes the date range', () => {
    const api = TestBed.inject(ReportsApi);
    api.summary('2026-07-01', '2026-07-31').subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/reports/summary');
    expect(req.request.params.get('from')).toBe('2026-07-01');
    req.flush({ revenue: '0', forfeited_advances: '0', bookings: {} });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `./api` not found.

- [ ] **Step 3: Implement `core/api.ts`**

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Booking, BookingDetail, BookingItem, Court, NewBooking, Payment,
  PaymentMethod, PaymentType, ReportSummary, TrendPoint, WorkerAccount,
} from './models';

function params(obj: Record<string, string | undefined>): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value) p = p.set(key, value);
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class CourtsApi {
  private http = inject(HttpClient);
  list() { return this.http.get<Court[]>('/api/courts'); }
}

@Injectable({ providedIn: 'root' })
export class BookingsApi {
  private http = inject(HttpClient);

  list(filters: { date?: string; from?: string; to?: string; status?: string; q?: string } = {}) {
    return this.http.get<Booking[]>('/api/bookings', { params: params(filters) });
  }
  get(id: string) { return this.http.get<BookingDetail>(`/api/bookings/${id}`); }
  create(booking: NewBooking) { return this.http.post<Booking>('/api/bookings', booking); }
  update(id: string, patch: Partial<NewBooking>) { return this.http.patch<Booking>(`/api/bookings/${id}`, patch); }
  arrive(id: string) { return this.http.post<Booking>(`/api/bookings/${id}/arrive`, {}); }
  complete(id: string) { return this.http.post<Booking>(`/api/bookings/${id}/complete`, {}); }
  cancel(id: string, reason?: string) { return this.http.post<Booking>(`/api/bookings/${id}/cancel`, reason ? { reason } : {}); }
  noShow(id: string) { return this.http.post<Booking>(`/api/bookings/${id}/no-show`, {}); }
  addPayment(id: string, p: { amount: number; type: PaymentType; method: PaymentMethod }) {
    return this.http.post<Payment>(`/api/bookings/${id}/payments`, p);
  }
  deletePayment(paymentId: string) { return this.http.delete<{ deleted: string }>(`/api/payments/${paymentId}`); }
  addItem(id: string, item: { item_name: string; quantity: number; unit_price: number }) {
    return this.http.post<BookingItem>(`/api/bookings/${id}/items`, item);
  }
  deleteItem(itemId: string) { return this.http.delete<{ deleted: string }>(`/api/items/${itemId}`); }
}

@Injectable({ providedIn: 'root' })
export class RemindersApi {
  private http = inject(HttpClient);
  list() { return this.http.get<Booking[]>('/api/reminders'); }
  ack(bookingId: string) { return this.http.post<{ ok: boolean }>(`/api/reminders/${bookingId}/ack`, {}); }
}

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private http = inject(HttpClient);
  summary(from: string, to: string) {
    return this.http.get<ReportSummary>('/api/reports/summary', { params: params({ from, to }) });
  }
  pending() { return this.http.get<Booking[]>('/api/reports/pending'); }
  trends(from: string, to: string) {
    return this.http.get<TrendPoint[]>('/api/reports/trends', { params: params({ from, to }) });
  }
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private http = inject(HttpClient);
  worker() { return this.http.get<WorkerAccount>('/api/users/worker'); }
  update(id: string, patch: Partial<{ name: string; phone: string; email: string | null; password: string; is_active: boolean }>) {
    return this.http.patch<WorkerAccount>(`/api/users/${id}`, patch);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: all specs PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: typed api services for all backend resources"
```

---

### Task 4: Shared UI (₹ pipe, status chip, date/permission helpers) and role shells

**Files:**
- Create: `frontend/src/app/shared/inr.pipe.ts`, `frontend/src/app/shared/status-chip.component.ts`, `frontend/src/app/core/booking-time.ts`, `frontend/src/app/core/permissions.ts`, `frontend/src/app/features/owner/owner-shell.component.ts`, `frontend/src/app/features/worker/worker-shell.component.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Test: `frontend/src/app/core/booking-time.spec.ts`, `frontend/src/app/core/permissions.spec.ts`

**Interfaces:**
- Consumes: guards, `AuthService`, models.
- Produces:
  - `inr` pipe: `'1040.00' → '₹1,040'` (en-IN grouping, drops trailing `.00`).
  - `<status-chip [status]="...">` — colored label for any `BookingStatus`.
  - `todayLocal(): string`, `daysAgoLocal(n): string` (browser-local `YYYY-MM-DD`); `plusTwoHours('HH:mm'): 'HH:mm'`; `toTimeInput(iso): 'HH:mm'`; `composeRange(date, startHHmm, endHHmm): { start_time, end_time }` (ISO; end rolls to next day if ≤ start).
  - `allowedActions(role, status, actionable): BookingAction[]` where `BookingAction = 'edit' | 'arrive' | 'complete' | 'cancel' | 'no_show' | 'add_payment' | 'add_item' | 'delete_entries'`.
  - Shell components with responsive Material toolbars and `<router-outlet/>`; routes `/owner/**` and `/worker/**` guarded by role.

- [ ] **Step 1: Write the failing tests**

`frontend/src/app/core/booking-time.spec.ts`:

```ts
import { composeRange, plusTwoHours, toTimeInput, todayLocal } from './booking-time';

describe('booking-time helpers', () => {
  it('plusTwoHours adds two hours', () => {
    expect(plusTwoHours('18:00')).toBe('20:00');
    expect(plusTwoHours('21:30')).toBe('23:30');
  });

  it('plusTwoHours wraps past midnight', () => {
    expect(plusTwoHours('23:00')).toBe('01:00');
  });

  it('todayLocal returns YYYY-MM-DD', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('composeRange produces ISO timestamps with end after start', () => {
    const { start_time, end_time } = composeRange('2026-07-15', '18:00', '20:00');
    expect(new Date(end_time).getTime() - new Date(start_time).getTime()).toBe(2 * 3_600_000);
  });

  it('composeRange rolls end to the next day when it is not after start', () => {
    const { start_time, end_time } = composeRange('2026-07-15', '23:00', '01:00');
    expect(new Date(end_time).getTime()).toBeGreaterThan(new Date(start_time).getTime());
    expect(new Date(end_time).getTime() - new Date(start_time).getTime()).toBe(2 * 3_600_000);
  });

  it('toTimeInput extracts local HH:mm from an ISO string', () => {
    const { start_time } = composeRange('2026-07-15', '09:05', '11:00');
    expect(toTimeInput(start_time)).toBe('09:05');
  });
});
```

`frontend/src/app/core/permissions.spec.ts`:

```ts
import { allowedActions } from './permissions';

describe('allowedActions', () => {
  it('owner on a confirmed booking gets the full set', () => {
    const actions = allowedActions('owner', 'confirmed', true);
    expect(actions).toContain('edit');
    expect(actions).toContain('arrive');
    expect(actions).toContain('cancel');
    expect(actions).toContain('no_show');
    expect(actions).toContain('add_payment');
    expect(actions).toContain('delete_entries');
    expect(actions).not.toContain('complete');
  });

  it('worker on a confirmed actionable booking cannot edit or cancel', () => {
    const actions = allowedActions('worker', 'confirmed', true);
    expect(actions).toContain('arrive');
    expect(actions).toContain('no_show');
    expect(actions).not.toContain('edit');
    expect(actions).not.toContain('cancel');
    expect(actions).not.toContain('delete_entries');
  });

  it('arrived allows complete and payments', () => {
    const actions = allowedActions('worker', 'arrived', true);
    expect(actions).toEqual(jasmine.arrayContaining(['complete', 'add_payment', 'add_item']));
    expect(actions).not.toContain('arrive');
  });

  it('worker outside the actionable window gets nothing', () => {
    expect(allowedActions('worker', 'confirmed', false)).toEqual([]);
  });

  it('cancelled and no_show allow no payments; owner keeps only deletes', () => {
    expect(allowedActions('worker', 'cancelled', true)).toEqual([]);
    expect(allowedActions('owner', 'no_show', true)).toEqual(['delete_entries']);
  });

  it('completed still allows payment/item logging', () => {
    expect(allowedActions('owner', 'completed', true))
      .toEqual(jasmine.arrayContaining(['add_payment', 'add_item', 'delete_entries']));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`frontend/src/app/core/booking-time.ts`:

```ts
/** Browser-local date as YYYY-MM-DD ('en-CA' formats ISO-style). */
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function daysAgoLocal(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toLocaleDateString('en-CA');
}

export function plusTwoHours(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String((h + 2) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Build ISO start/end from a local date + HH:mm inputs. If end ≤ start it is
 *  taken to be on the next day (late-night games crossing midnight). */
export function composeRange(date: string, start: string, end: string): { start_time: string; end_time: string } {
  const startDate = new Date(`${date}T${start}`);
  let endDate = new Date(`${date}T${end}`);
  if (endDate <= startDate) endDate = new Date(endDate.getTime() + 86_400_000);
  return { start_time: startDate.toISOString(), end_time: endDate.toISOString() };
}
```

`frontend/src/app/core/permissions.ts`:

```ts
import { BookingStatus, Role } from './models';

export type BookingAction =
  | 'edit' | 'arrive' | 'complete' | 'cancel' | 'no_show'
  | 'add_payment' | 'add_item' | 'delete_entries';

/** Mirrors the server's rules for UI purposes only — the API re-enforces all of it.
 *  `actionable` = booking_date is today or later (worker mutation window). */
export function allowedActions(role: Role, status: BookingStatus, actionable: boolean): BookingAction[] {
  if (role === 'worker' && !actionable) return [];
  const actions: BookingAction[] = [];
  if (status === 'confirmed') {
    actions.push('arrive', 'no_show');
    if (role === 'owner') actions.push('edit', 'cancel');
  }
  if (status === 'arrived') actions.push('complete');
  if (status !== 'cancelled' && status !== 'no_show') actions.push('add_payment', 'add_item');
  if (role === 'owner') actions.push('delete_entries');
  return actions;
}
```

`frontend/src/app/shared/inr.pipe.ts`:

```ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    const n = Number(value ?? 0);
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
}
```

`frontend/src/app/shared/status-chip.component.ts`:

```ts
import { Component, Input } from '@angular/core';
import { BookingStatus } from '../core/models';

const LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmed', arrived: 'Arrived', completed: 'Completed',
  cancelled: 'Cancelled', no_show: 'No-show',
};

@Component({
  selector: 'status-chip',
  template: `<span class="chip" [class]="status">{{ label }}</span>`,
  styles: `
    .chip { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; }
    .confirmed { background: #e3f2fd; color: #1565c0; }
    .arrived { background: #fff8e1; color: #b26a00; }
    .completed { background: #e8f5e9; color: #2e7d32; }
    .cancelled { background: #fbe9e7; color: #c62828; }
    .no_show { background: #efebe9; color: #5d4037; }
  `,
})
export class StatusChipComponent {
  @Input({ required: true }) status!: BookingStatus;
  get label(): string { return LABELS[this.status]; }
}
```

`frontend/src/app/features/owner/owner-shell.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-owner-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary">
      <span class="title">Box Cricket</span>
      <nav>
        <a mat-button routerLink="/owner/bookings" routerLinkActive="active">Bookings</a>
        <a mat-button routerLink="/owner/reports" routerLinkActive="active">Reports</a>
        <a mat-button routerLink="/owner/settings" routerLinkActive="active">Settings</a>
      </nav>
      <span class="spacer"></span>
      <button mat-icon-button (click)="auth.logout()" aria-label="Log out"><mat-icon>logout</mat-icon></button>
    </mat-toolbar>
    <main><router-outlet /></main>
  `,
  styles: `
    .spacer { flex: 1; }
    .title { margin-right: 16px; }
    nav { display: flex; overflow-x: auto; }
    nav a.active { text-decoration: underline; text-underline-offset: 6px; }
    main { padding: 16px; max-width: 1100px; margin: 0 auto; }
    @media (max-width: 600px) { .title { display: none; } main { padding: 8px; } }
  `,
})
export class OwnerShellComponent {
  protected auth = inject(AuthService);
}
```

`frontend/src/app/features/worker/worker-shell.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-worker-shell',
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary">
      <span>Box Cricket — {{ auth.user?.name }}</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="auth.logout()" aria-label="Log out"><mat-icon>logout</mat-icon></button>
    </mat-toolbar>
    <main><router-outlet /></main>
  `,
  styles: `
    .spacer { flex: 1; }
    main { padding: 12px; max-width: 800px; margin: 0 auto; }
  `,
})
export class WorkerShellComponent {
  protected auth = inject(AuthService);
}
```

Replace `frontend/src/app/app.routes.ts` (detail/list components arrive in Tasks 5–9 — use lazy `loadComponent` so this file compiles only when each component lands; add each route in the task that creates its component):

```ts
import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';
import { LoginComponent } from './features/login/login.component';
import { OwnerShellComponent } from './features/owner/owner-shell.component';
import { WorkerShellComponent } from './features/worker/worker-shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'owner',
    component: OwnerShellComponent,
    canActivate: [authGuard, roleGuard('owner')],
    children: [
      // Task 5: { path: 'bookings', loadComponent: ... }
      // Task 6: { path: 'bookings/:id', loadComponent: ... }
      // Task 7: { path: 'reports', loadComponent: ... }
      // Task 8: { path: 'settings', loadComponent: ... }
      { path: '', pathMatch: 'full', redirectTo: 'bookings' },
    ],
  },
  {
    path: 'worker',
    component: WorkerShellComponent,
    canActivate: [authGuard, roleGuard('worker')],
    children: [
      // Task 9: { path: '', loadComponent: ... (dashboard) }
      // Task 6: { path: 'bookings/:id', loadComponent: ... }
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless && npx ng build`
Expected: specs PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: shared ui atoms, permission/time helpers, role shells and routes"
```

---

### Task 5: Owner bookings list + booking form dialog (create/edit)

**Files:**
- Create: `frontend/src/app/features/owner/bookings-list.component.ts`, `frontend/src/app/features/owner/booking-form-dialog.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (add `bookings` child route)
- Test: `frontend/src/app/features/owner/booking-form-dialog.spec.ts`

**Interfaces:**
- Consumes: `BookingsApi`, `CourtsApi`, `composeRange`, `plusTwoHours`, `toTimeInput`, `todayLocal`, `InrPipe`, `StatusChipComponent`.
- Produces: `BookingFormDialogComponent` opened via `MatDialog` with `data: { booking?: BookingDetail }` — creates when no booking passed, edits otherwise; closes with `true` on success. Route `/owner/bookings`.

- [ ] **Step 1: Write the failing test**

`frontend/src/app/features/owner/booking-form-dialog.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BookingFormDialogComponent } from './booking-form-dialog.component';

describe('BookingFormDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BookingFormDialogComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy() } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ],
    });
  });

  it('defaults end time to start + 2 hours while end is untouched', () => {
    const fixture = TestBed.createComponent(BookingFormDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.start.setValue('19:00');
    expect(component.form.controls.end.value).toBe('21:00');
  });

  it('stops auto-syncing end once the user edits it', () => {
    const fixture = TestBed.createComponent(BookingFormDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.end.setValue('22:30');
    component.form.controls.end.markAsDirty();
    component.form.controls.start.setValue('19:00');
    expect(component.form.controls.end.value).toBe('22:30');
  });

  it('requires name, phone and a positive amount', () => {
    const fixture = TestBed.createComponent(BookingFormDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ customer_name: '', customer_phone: 'abc', total_amount: 0 });
    expect(component.form.valid).toBeFalse();
    component.form.patchValue({ customer_name: 'Ravi', customer_phone: '9876543210', total_amount: 1200 });
    expect(component.form.valid).toBeTrue();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

`frontend/src/app/features/owner/booking-form-dialog.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BookingsApi, CourtsApi } from '../../core/api';
import { composeRange, plusTwoHours, toTimeInput, todayLocal } from '../../core/booking-time';
import { BookingDetail, Court, NewBooking } from '../../core/models';

@Component({
  selector: 'app-booking-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ booking ? 'Edit booking' : 'New booking' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="booking-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="date" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Start</mat-label>
            <input matInput type="time" formControlName="start" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>End</mat-label>
            <input matInput type="time" formControlName="end" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Customer name</mat-label>
          <input matInput formControlName="customer_name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Customer phone</mat-label>
          <input matInput type="tel" formControlName="customer_phone" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Total amount (₹)</mat-label>
          <input matInput type="number" formControlName="total_amount" />
        </mat-form-field>
        @if (error) { <p class="error">{{ error }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button form="booking-form" type="submit" [disabled]="form.invalid || saving">
        {{ booking ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 4px; min-width: min(420px, 80vw); }
    .row { display: flex; gap: 8px; }
    .row mat-form-field { flex: 1; }
    .error { color: var(--mat-sys-error, #b00020); margin: 0; }
  `,
})
export class BookingFormDialogComponent {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(BookingsApi);
  private courtsApi = inject(CourtsApi);
  private ref = inject(MatDialogRef<BookingFormDialogComponent>);
  protected booking?: BookingDetail = inject<{ booking?: BookingDetail }>(MAT_DIALOG_DATA).booking;

  saving = false;
  error = '';
  private courts: Court[] = [];

  form = this.fb.group({
    date: [this.booking?.booking_date ?? todayLocal(), Validators.required],
    start: [this.booking ? toTimeInput(this.booking.start_time) : '18:00', Validators.required],
    end: [this.booking ? toTimeInput(this.booking.end_time) : '20:00', Validators.required],
    customer_name: [this.booking?.customer_name ?? '', [Validators.required, Validators.maxLength(100)]],
    customer_phone: [this.booking?.customer_phone ?? '', [Validators.required, Validators.pattern(/^[0-9+\- ]{7,15}$/)]],
    total_amount: [this.booking ? Number(this.booking.total_amount) : 0, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    this.courtsApi.list().pipe(takeUntilDestroyed()).subscribe((c) => (this.courts = c));
    if (this.booking) this.form.controls.end.markAsDirty();
    this.form.controls.start.valueChanges.pipe(takeUntilDestroyed()).subscribe((start) => {
      if (!this.form.controls.end.dirty) this.form.controls.end.setValue(plusTwoHours(start), { emitEvent: false });
    });
  }

  save(): void {
    if (this.form.invalid || this.saving) return;
    const v = this.form.getRawValue();
    const courtId = this.booking?.court_id ?? this.courts[0]?.id;
    if (!courtId) { this.error = 'No court available'; return; }
    const payload: NewBooking = {
      court_id: courtId,
      customer_name: v.customer_name,
      customer_phone: v.customer_phone,
      booking_date: v.date,
      ...composeRange(v.date, v.start, v.end),
      total_amount: v.total_amount,
    };
    this.saving = true;
    const call = this.booking ? this.api.update(this.booking.id, payload) : this.api.create(payload);
    call.subscribe({
      next: () => this.ref.close(true),
      error: (err) => {
        this.saving = false;
        this.error = err.error?.error?.message ?? 'Could not save booking';
      },
    });
  }
}
```

`frontend/src/app/features/owner/bookings-list.component.ts`:

```ts
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { BookingsApi } from '../../core/api';
import { Booking, BookingStatus } from '../../core/models';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';
import { BookingFormDialogComponent } from './booking-form-dialog.component';

@Component({
  selector: 'app-bookings-list',
  imports: [
    ReactiveFormsModule, RouterLink, DatePipe, InrPipe, StatusChipComponent,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Date</mat-label>
        <input matInput type="date" [formControl]="date" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [formControl]="status">
          <mat-option value="">All</mat-option>
          @for (s of statuses; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="grow">
        <mat-label>Search name or phone</mat-label>
        <input matInput [formControl]="q" />
      </mat-form-field>
      <button mat-flat-button (click)="newBooking()"><mat-icon>add</mat-icon> New booking</button>
    </div>

    @if (bookings().length === 0) { <p class="empty">No bookings match.</p> }
    <div class="cards">
      @for (b of bookings(); track b.id) {
        <mat-card appearance="outlined" [routerLink]="['/owner/bookings', b.id]">
          <mat-card-content>
            <div class="line1">
              <strong>{{ b.customer_name }}</strong>
              <status-chip [status]="b.status" />
            </div>
            <div>{{ b.start_time | date: 'EEE d MMM, h:mm a' }} – {{ b.end_time | date: 'h:mm a' }}</div>
            <div class="line3">
              <span>{{ b.customer_phone }}</span>
              <span>Due: {{ b.balance_due | inr }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .filters .grow { flex: 1; min-width: 180px; }
    .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    mat-card { cursor: pointer; }
    .line1, .line3 { display: flex; justify-content: space-between; align-items: center; }
    .line3 { color: rgba(0 0 0 / 60%); font-size: 13px; }
    .empty { text-align: center; opacity: 0.7; padding: 24px; }
  `,
})
export class BookingsListComponent {
  private api = inject(BookingsApi);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  readonly statuses: BookingStatus[] = ['confirmed', 'arrived', 'completed', 'cancelled', 'no_show'];
  bookings = signal<Booking[]>([]);

  date = new FormControl('', { nonNullable: true });
  status = new FormControl('', { nonNullable: true });
  q = new FormControl('', { nonNullable: true });

  constructor() {
    this.load();
    this.date.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.status.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.q.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  load(): void {
    this.api.list({
      date: this.date.value || undefined,
      status: this.status.value || undefined,
      q: this.q.value || undefined,
    }).subscribe((rows) => this.bookings.set(rows));
  }

  newBooking(): void {
    this.dialog.open(BookingFormDialogComponent, { data: {}, maxWidth: '95vw' })
      .afterClosed().subscribe((created) => {
        if (created) {
          this.snack.open('Booking created', undefined, { duration: 2500 });
          this.load();
        }
      });
  }
}
```

In `frontend/src/app/app.routes.ts`, add to the owner `children` (replacing the Task 5 comment):

```ts
{ path: 'bookings', loadComponent: () => import('./features/owner/bookings-list.component').then(m => m.BookingsListComponent) },
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless && npx ng build`
Expected: specs PASS, build succeeds.

- [ ] **Step 5: Manual check (needs backend running)**

Run `npm run dev` at the root, log in as the seeded owner at `http://localhost:4200`, create a booking for today, see it in the list, try an overlapping one and confirm the snackbar/dialog shows "This time slot overlaps an existing booking on this court."

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: owner bookings list with filters and create/edit dialog"
```

---

### Task 6: Role-aware booking detail with payments, items, and actions

**Files:**
- Create: `frontend/src/app/features/bookings/booking-detail.component.ts`, `frontend/src/app/features/bookings/payment-dialog.component.ts`, `frontend/src/app/features/bookings/item-dialog.component.ts`, `frontend/src/app/features/bookings/cancel-dialog.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (owner + worker `bookings/:id` routes)
- Test: `frontend/src/app/features/bookings/booking-detail.spec.ts`

**Interfaces:**
- Consumes: `BookingsApi`, `allowedActions`, `todayLocal`, `AuthService`, shared UI, dialogs.
- Produces: one `BookingDetailComponent` used by both roles (`/owner/bookings/:id` and `/worker/bookings/:id`); action buttons follow `allowedActions`; owner sees delete icons on payments/items.

- [ ] **Step 1: Write the failing test**

`frontend/src/app/features/bookings/booking-detail.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { fakeJwt } from '../../core/auth.service.spec';
import { BookingDetail } from '../../core/models';
import { BookingDetailComponent } from './booking-detail.component';

function detail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  const future = new Date(Date.now() + 86_400_000);
  return {
    id: 'b1', court_id: 'c1', customer_name: 'Ravi', customer_phone: '9876543210',
    booking_date: future.toLocaleDateString('en-CA'),
    start_time: future.toISOString(), end_time: new Date(future.getTime() + 7_200_000).toISOString(),
    total_amount: '1000.00', status: 'confirmed', advance_forfeited: false,
    cancellation_reason: null, reminder_acknowledged: false,
    created_at: '', updated_at: '', total_due: '1040.00', total_paid: '500.00', balance_due: '540.00',
    payments: [{ id: 'p1', booking_id: 'b1', amount: '500.00', type: 'advance', method: 'upi', collected_by: 'u', paid_at: future.toISOString() }],
    items: [{ id: 'i1', booking_id: 'b1', item_name: 'Water', quantity: 2, unit_price: '20.00', total_price: '40.00', added_by: 'u', added_at: future.toISOString() }],
    ...overrides,
  };
}

describe('BookingDetailComponent', () => {
  let ctrl: HttpTestingController;

  function setup(role: 'owner' | 'worker', data: BookingDetail) {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role, name: 'T' }));
    TestBed.configureTestingModule({
      imports: [BookingDetailComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'b1']]) } } },
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BookingDetailComponent);
    fixture.detectChanges();
    ctrl.expectOne('/api/bookings/b1').flush(data);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => { ctrl.verify(); localStorage.clear(); });

  it('shows balance and offers owner the full confirmed action set', () => {
    const fixture = setup('owner', detail());
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('₹540');
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b: any) => b.textContent.trim());
    expect(labels.some((l: string) => l.includes('Mark arrived'))).toBeTrue();
    expect(labels.some((l: string) => l.includes('Cancel booking'))).toBeTrue();
  });

  it('hides owner-only actions from the worker and shows no delete icons', () => {
    const fixture = setup('worker', detail());
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('Cancel booking');
    expect(html).not.toContain('Edit');
    expect(fixture.nativeElement.querySelectorAll('[data-test="delete-payment"]').length).toBe(0);
  });

  it('offers nothing to a worker on a past booking', () => {
    const past = new Date(Date.now() - 3 * 86_400_000);
    const fixture = setup('worker', detail({
      booking_date: past.toLocaleDateString('en-CA'),
      start_time: past.toISOString(), end_time: new Date(past.getTime() + 7_200_000).toISOString(),
    }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b: any) => b.textContent.trim());
    expect(labels.some((l: string) => l.includes('Mark arrived'))).toBeFalse();
    expect(labels.some((l: string) => l.includes('Add payment'))).toBeFalse();
  });

  it('shows the completed state with no transition buttons', () => {
    const fixture = setup('owner', detail({ status: 'completed' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b: any) => b.textContent.trim());
    expect(labels.some((l: string) => l.includes('Mark arrived'))).toBeFalse();
    expect(labels.some((l: string) => l.includes('Add payment'))).toBeTrue();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement the dialogs**

`frontend/src/app/features/bookings/payment-dialog.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { PaymentMethod, PaymentType } from '../../core/models';

export interface PaymentDialogResult { amount: number; type: PaymentType; method: PaymentMethod; }

@Component({
  selector: 'app-payment-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Record payment</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="payment-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Amount (₹)</mat-label>
          <input matInput type="number" formControlName="amount" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select formControlName="type">
            <mat-option value="advance">Advance</mat-option>
            <mat-option value="remaining">Remaining</mat-option>
            <mat-option value="extra">Extra</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-radio-group formControlName="method">
          <mat-radio-button value="cash">Cash</mat-radio-button>
          <mat-radio-button value="upi">UPI</mat-radio-button>
        </mat-radio-group>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button form="payment-form" type="submit" [disabled]="form.invalid">Save</button>
    </mat-dialog-actions>
  `,
  styles: `form { display: flex; flex-direction: column; gap: 8px; min-width: min(320px, 80vw); }`,
})
export class PaymentDialogComponent {
  private fb = inject(NonNullableFormBuilder);
  private ref = inject(MatDialogRef<PaymentDialogComponent, PaymentDialogResult>);
  form = this.fb.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    type: ['remaining' as PaymentType, Validators.required],
    method: ['cash' as PaymentMethod, Validators.required],
  });
  save(): void {
    if (this.form.valid) this.ref.close(this.form.getRawValue());
  }
}
```

`frontend/src/app/features/bookings/item-dialog.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ItemDialogResult { item_name: string; quantity: number; unit_price: number; }

@Component({
  selector: 'app-item-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Add item</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="item-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Item</mat-label>
          <input matInput formControlName="item_name" placeholder="Water bottle" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Qty</mat-label>
            <input matInput type="number" formControlName="quantity" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Unit price (₹)</mat-label>
            <input matInput type="number" formControlName="unit_price" />
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button form="item-form" type="submit" [disabled]="form.invalid">Add</button>
    </mat-dialog-actions>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 8px; min-width: min(320px, 80vw); }
    .row { display: flex; gap: 8px; } .row mat-form-field { flex: 1; }
  `,
})
export class ItemDialogComponent {
  private fb = inject(NonNullableFormBuilder);
  private ref = inject(MatDialogRef<ItemDialogComponent, ItemDialogResult>);
  form = this.fb.group({
    item_name: ['', [Validators.required, Validators.maxLength(100)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit_price: [0, [Validators.required, Validators.min(0)]],
  });
  save(): void {
    if (this.form.valid) this.ref.close(this.form.getRawValue());
  }
}
```

`frontend/src/app/features/bookings/cancel-dialog.component.ts`:

```ts
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-cancel-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Cancel booking?</h2>
    <mat-dialog-content>
      <p>The advance (if any) is forfeited. This cannot be undone.</p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Reason (optional)</mat-label>
        <textarea matInput [formControl]="reason" rows="2"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Keep booking</button>
      <button mat-flat-button [mat-dialog-close]="{ confirmed: true, reason: reason.value }">Cancel booking</button>
    </mat-dialog-actions>
  `,
  styles: `.full { width: 100%; }`,
})
export class CancelDialogComponent {
  reason = new FormControl('', { nonNullable: true });
}
```

- [ ] **Step 4: Implement the detail component**

`frontend/src/app/features/bookings/booking-detail.component.ts`:

```ts
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { BookingsApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { todayLocal } from '../../core/booking-time';
import { BookingDetail } from '../../core/models';
import { BookingAction, allowedActions } from '../../core/permissions';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';
import { BookingFormDialogComponent } from '../owner/booking-form-dialog.component';
import { CancelDialogComponent } from './cancel-dialog.component';
import { ItemDialogComponent, ItemDialogResult } from './item-dialog.component';
import { PaymentDialogComponent, PaymentDialogResult } from './payment-dialog.component';

@Component({
  selector: 'app-booking-detail',
  imports: [DatePipe, InrPipe, StatusChipComponent, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    @if (booking(); as b) {
      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="head">
            <h2>{{ b.customer_name }}</h2>
            <status-chip [status]="b.status" />
          </div>
          <p>{{ b.start_time | date: 'EEEE d MMM y, h:mm a' }} – {{ b.end_time | date: 'h:mm a' }}</p>
          <p>{{ b.customer_phone }}</p>
          @if (b.cancellation_reason) { <p>Reason: {{ b.cancellation_reason }}</p> }
          @if (b.advance_forfeited) { <p class="forfeit">Advance forfeited</p> }
          <div class="balances">
            <div><span>Total due</span><strong>{{ b.total_due | inr }}</strong></div>
            <div><span>Paid</span><strong>{{ b.total_paid | inr }}</strong></div>
            <div><span>Balance</span><strong>{{ b.balance_due | inr }}</strong></div>
          </div>
          <div class="actions">
            @if (can('arrive')) { <button mat-flat-button (click)="run(api.arrive(b.id))">Mark arrived</button> }
            @if (can('complete')) { <button mat-flat-button (click)="run(api.complete(b.id))">Mark completed</button> }
            @if (can('no_show')) { <button mat-stroked-button (click)="run(api.noShow(b.id))">No-show</button> }
            @if (can('edit')) { <button mat-stroked-button (click)="edit()">Edit</button> }
            @if (can('cancel')) { <button mat-stroked-button (click)="cancel()">Cancel booking</button> }
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="head">
            <h3>Payments</h3>
            @if (can('add_payment')) { <button mat-stroked-button (click)="addPayment()">Add payment</button> }
          </div>
          @for (p of b.payments; track p.id) {
            <div class="rowline">
              <span>{{ p.paid_at | date: 'd MMM, h:mm a' }} · {{ p.type }} · {{ p.method }}</span>
              <span class="amount">
                {{ p.amount | inr }}
                @if (can('delete_entries')) {
                  <button mat-icon-button data-test="delete-payment" aria-label="Delete payment" (click)="deletePayment(p.id)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </span>
            </div>
          } @empty { <p class="empty">No payments yet.</p> }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="head">
            <h3>Extra items</h3>
            @if (can('add_item')) { <button mat-stroked-button (click)="addItem()">Add item</button> }
          </div>
          @for (i of b.items; track i.id) {
            <div class="rowline">
              <span>{{ i.item_name }} × {{ i.quantity }}</span>
              <span class="amount">
                {{ i.total_price | inr }}
                @if (can('delete_entries')) {
                  <button mat-icon-button data-test="delete-item" aria-label="Delete item" (click)="deleteItem(i.id)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </span>
            </div>
          } @empty { <p class="empty">No extra items.</p> }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    h2, h3 { margin: 0; }
    .balances { display: flex; gap: 24px; margin: 12px 0; flex-wrap: wrap; }
    .balances div { display: flex; flex-direction: column; }
    .balances span { font-size: 12px; opacity: 0.7; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .rowline { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
    .amount { display: flex; align-items: center; gap: 4px; }
    .forfeit { color: #c62828; font-weight: 500; }
    .empty { opacity: 0.6; }
  `,
})
export class BookingDetailComponent {
  protected api = inject(BookingsApi);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  booking = signal<BookingDetail | null>(null);
  private actions = computed<BookingAction[]>(() => {
    const b = this.booking();
    const user = this.auth.user;
    if (!b || !user) return [];
    return allowedActions(user.role, b.status, b.booking_date >= todayLocal());
  });

  constructor() {
    this.reload();
  }

  private get id(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  can(action: BookingAction): boolean {
    return this.actions().includes(action);
  }

  reload(): void {
    this.api.get(this.id).subscribe({
      next: (b) => this.booking.set(b),
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Could not load booking', undefined, { duration: 4000 }),
    });
  }

  run(call: Observable<unknown>): void {
    call.subscribe({
      next: () => { this.snack.open('Updated', undefined, { duration: 2000 }); this.reload(); },
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Action failed', undefined, { duration: 4000 }),
    });
  }

  edit(): void {
    this.dialog.open(BookingFormDialogComponent, { data: { booking: this.booking() }, maxWidth: '95vw' })
      .afterClosed().subscribe((saved) => { if (saved) this.reload(); });
  }

  cancel(): void {
    this.dialog.open(CancelDialogComponent, { maxWidth: '95vw' }).afterClosed().subscribe((result) => {
      if (result?.confirmed) this.run(this.api.cancel(this.id, result.reason || undefined));
    });
  }

  addPayment(): void {
    this.dialog.open(PaymentDialogComponent, { maxWidth: '95vw' })
      .afterClosed().subscribe((p: PaymentDialogResult | undefined) => {
        if (p) this.run(this.api.addPayment(this.id, p));
      });
  }

  addItem(): void {
    this.dialog.open(ItemDialogComponent, { maxWidth: '95vw' })
      .afterClosed().subscribe((i: ItemDialogResult | undefined) => {
        if (i) this.run(this.api.addItem(this.id, i));
      });
  }

  deletePayment(paymentId: string): void {
    if (confirm('Delete this payment entry?')) this.run(this.api.deletePayment(paymentId));
  }

  deleteItem(itemId: string): void {
    if (confirm('Delete this item?')) this.run(this.api.deleteItem(itemId));
  }
}
```

In `frontend/src/app/app.routes.ts`, add the detail route to **both** shells' children:

```ts
// owner children:
{ path: 'bookings/:id', loadComponent: () => import('./features/bookings/booking-detail.component').then(m => m.BookingDetailComponent) },
// worker children:
{ path: 'bookings/:id', loadComponent: () => import('./features/bookings/booking-detail.component').then(m => m.BookingDetailComponent) },
```

- [ ] **Step 5: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless && npx ng build`
Expected: specs PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: role-aware booking detail with payments, items, and status actions"
```

---

### Task 7: Owner reports screen

**Files:**
- Create: `frontend/src/app/features/owner/reports.component.ts`
- Modify: `frontend/src/app/app.config.ts` (chart providers), `frontend/src/app/app.routes.ts` (reports route)
- Test: `frontend/src/app/features/owner/reports.spec.ts`

**Interfaces:**
- Consumes: `ReportsApi`, `InrPipe`, `StatusChipComponent`, `todayLocal`, ng2-charts `BaseChartDirective`.
- Produces: `/owner/reports` — date-range inputs (default: 1st of current month → today), summary cards, pending-payments table (horizontal scroll on mobile), bookings/revenue-per-day line chart.

- [ ] **Step 1: Write the failing test**

`frontend/src/app/features/owner/reports.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ReportsComponent } from './reports.component';

describe('ReportsComponent', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
        provideRouter([]), provideCharts(withDefaultRegisterables()),
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('loads summary, pending, and trends for the default range on init', () => {
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();

    const summary = ctrl.expectOne((r) => r.url === '/api/reports/summary');
    expect(summary.request.params.get('from')).toMatch(/^\d{4}-\d{2}-01$/);
    summary.flush({ revenue: '5400', forfeited_advances: '300', bookings: { confirmed: 2, completed: 5 } });

    ctrl.expectOne('/api/reports/pending').flush([]);
    ctrl.expectOne((r) => r.url === '/api/reports/trends')
      .flush([{ day: '2026-07-01', bookings: 2, revenue: '2000' }]);

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('₹5,400');
    expect(text).toContain('₹300');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

In `frontend/src/app/app.config.ts`, add to providers:

```ts
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
// inside providers: [...]
provideCharts(withDefaultRegisterables()),
```

`frontend/src/app/features/owner/reports.component.ts`:

```ts
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportsApi } from '../../core/api';
import { todayLocal } from '../../core/booking-time';
import { Booking, ReportSummary, TrendPoint } from '../../core/models';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';

@Component({
  selector: 'app-reports',
  imports: [
    ReactiveFormsModule, DatePipe, InrPipe, StatusChipComponent, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, BaseChartDirective,
  ],
  template: `
    <div class="range">
      <mat-form-field appearance="outline">
        <mat-label>From</mat-label>
        <input matInput type="date" [formControl]="from" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>To</mat-label>
        <input matInput type="date" [formControl]="to" />
      </mat-form-field>
    </div>

    @if (summary(); as s) {
      <div class="cards">
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Revenue</span><strong>{{ s.revenue | inr }}</strong>
        </mat-card-content></mat-card>
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Forfeited advances</span><strong>{{ s.forfeited_advances | inr }}</strong>
        </mat-card-content></mat-card>
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Completed</span><strong>{{ s.bookings.completed ?? 0 }}</strong>
        </mat-card-content></mat-card>
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Cancelled / no-show</span>
          <strong>{{ (s.bookings.cancelled ?? 0) + (s.bookings.no_show ?? 0) }}</strong>
        </mat-card-content></mat-card>
      </div>
    }

    <mat-card appearance="outlined">
      <mat-card-content>
        <h3>Bookings & revenue per day</h3>
        <canvas baseChart type="line" [data]="chartData" [options]="chartOptions"></canvas>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined">
      <mat-card-content>
        <h3>Pending payments</h3>
        <div class="scroll">
          <table>
            <thead><tr><th>Date</th><th>Customer</th><th>Status</th><th>Balance due</th></tr></thead>
            <tbody>
              @for (b of pending(); track b.id) {
                <tr [routerLink]="['/owner/bookings', b.id]">
                  <td>{{ b.start_time | date: 'd MMM, h:mm a' }}</td>
                  <td>{{ b.customer_name }}<br /><small>{{ b.customer_phone }}</small></td>
                  <td><status-chip [status]="b.status" /></td>
                  <td>{{ b.balance_due | inr }}</td>
                </tr>
              } @empty { <tr><td colspan="4" class="empty">Nothing pending.</td></tr> }
            </tbody>
          </table>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .range { display: flex; gap: 8px; flex-wrap: wrap; }
    .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .cards mat-card-content { display: flex; flex-direction: column; }
    .label { font-size: 12px; opacity: 0.7; }
    .cards strong { font-size: 22px; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid rgba(0 0 0 / 10%); white-space: nowrap; }
    tbody tr { cursor: pointer; }
    .empty { opacity: 0.6; text-align: center; }
    h3 { margin: 0 0 8px; }
  `,
})
export class ReportsComponent {
  private api = inject(ReportsApi);

  from = new FormControl(todayLocal().slice(0, 8) + '01', { nonNullable: true });
  to = new FormControl(todayLocal(), { nonNullable: true });

  summary = signal<ReportSummary | null>(null);
  pending = signal<Booking[]>([]);
  chartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    scales: { bookings: { type: 'linear', position: 'right', ticks: { precision: 0 } }, y: { type: 'linear', position: 'left' } },
  };

  constructor() {
    this.load();
    this.from.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.to.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load(): void {
    const from = this.from.value;
    const to = this.to.value;
    if (!from || !to || from > to) return;
    this.api.summary(from, to).subscribe((s) => this.summary.set(s));
    this.api.pending().subscribe((p) => this.pending.set(p));
    this.api.trends(from, to).subscribe((t) => this.setChart(t));
  }

  private setChart(points: TrendPoint[]): void {
    this.chartData = {
      labels: points.map((p) => p.day),
      datasets: [
        { label: 'Revenue (₹)', data: points.map((p) => Number(p.revenue)), yAxisID: 'y', tension: 0.3 },
        { label: 'Bookings', data: points.map((p) => p.bookings), yAxisID: 'bookings', tension: 0.3 },
      ],
    };
  }
}
```

In `frontend/src/app/app.routes.ts`, add to owner children:

```ts
{ path: 'reports', loadComponent: () => import('./features/owner/reports.component').then(m => m.ReportsComponent) },
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless && npx ng build`
Expected: specs PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: owner reports with summary cards, pending table, trends chart"
```

---

### Task 8: Owner settings (worker account + own password)

**Files:**
- Create: `frontend/src/app/features/owner/settings.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (settings route)
- Test: `frontend/src/app/features/owner/settings.spec.ts`

**Interfaces:**
- Consumes: `UsersApi`, `AuthService`.
- Produces: `/owner/settings` — worker form (name, phone, email, active toggle, optional new password) → `PATCH /api/users/:workerId`; separate own-password form → `PATCH /api/users/:ownId`.

- [ ] **Step 1: Write the failing test**

`frontend/src/app/features/owner/settings.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { fakeJwt } from '../../core/auth.service.spec';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('token', fakeJwt({ sub: 'owner-1', role: 'owner', name: 'O' }));
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideRouter([])],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { ctrl.verify(); localStorage.clear(); });

  it('loads the worker and PATCHes only changed/filled fields', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    ctrl.expectOne('/api/users/worker').flush({
      id: 'w1', name: 'Worker', phone: '9000000002', email: null, role: 'worker', is_active: true,
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.workerForm.patchValue({ name: 'Renamed', password: '' });
    component.saveWorker();
    const req = ctrl.expectOne('/api/users/w1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.name).toBe('Renamed');
    expect('password' in req.request.body).toBeFalse(); // empty password not sent
    req.flush({ id: 'w1', name: 'Renamed', phone: '9000000002', email: null, role: 'worker', is_active: true });
  });

  it('changes own password via own user id from the JWT', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    ctrl.expectOne('/api/users/worker').flush({
      id: 'w1', name: 'Worker', phone: '9000000002', email: null, role: 'worker', is_active: true,
    });

    const component = fixture.componentInstance;
    component.ownPassword.setValue('newownerpass');
    component.saveOwnPassword();
    const req = ctrl.expectOne('/api/users/owner-1');
    expect(req.request.body).toEqual({ password: 'newownerpass' });
    req.flush({ id: 'owner-1', name: 'O', phone: 'x', email: null, role: 'owner', is_active: true });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `settings.component.ts`**

```ts
import { Component, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UsersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { WorkerAccount } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSlideToggleModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Worker account</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="workerForm" (ngSubmit)="saveWorker()">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Phone</mat-label>
            <input matInput type="tel" formControlName="phone" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email (optional)</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>New password (leave blank to keep)</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
          </mat-form-field>
          <mat-slide-toggle formControlName="is_active">Account active</mat-slide-toggle>
          <button mat-flat-button type="submit" [disabled]="workerForm.invalid || !worker()">Save worker</button>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Change my password</mat-card-title></mat-card-header>
      <mat-card-content>
        <form (ngSubmit)="saveOwnPassword()">
          <mat-form-field appearance="outline">
            <mat-label>New password</mat-label>
            <input matInput type="password" [formControl]="ownPassword" autocomplete="new-password" />
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="ownPassword.invalid">Update password</button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; max-width: 480px; }
    form { display: flex; flex-direction: column; gap: 8px; }
    button { align-self: flex-start; }
  `,
})
export class SettingsComponent {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(UsersApi);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  worker = signal<WorkerAccount | null>(null);

  workerForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\- ]{7,15}$/)]],
    email: [''],
    password: ['', [Validators.minLength(8)]],
    is_active: [true],
  });

  ownPassword = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] });

  constructor() {
    this.api.worker().subscribe((w) => {
      this.worker.set(w);
      this.workerForm.patchValue({ name: w.name, phone: w.phone, email: w.email ?? '', is_active: w.is_active });
    });
  }

  saveWorker(): void {
    const w = this.worker();
    if (!w || this.workerForm.invalid) return;
    const v = this.workerForm.getRawValue();
    const patch: Record<string, unknown> = {
      name: v.name, phone: v.phone, email: v.email || null, is_active: v.is_active,
    };
    if (v.password) patch.password = v.password;
    this.api.update(w.id, patch).subscribe({
      next: (updated) => {
        this.worker.set(updated);
        this.workerForm.controls.password.reset('');
        this.snack.open('Worker account saved', undefined, { duration: 2500 });
      },
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Save failed', undefined, { duration: 4000 }),
    });
  }

  saveOwnPassword(): void {
    const me = this.auth.user;
    if (!me || this.ownPassword.invalid) return;
    this.api.update(me.id, { password: this.ownPassword.value }).subscribe({
      next: () => { this.ownPassword.reset(''); this.snack.open('Password updated', undefined, { duration: 2500 }); },
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Update failed', undefined, { duration: 4000 }),
    });
  }
}
```

In `frontend/src/app/app.routes.ts`, add to owner children:

```ts
{ path: 'settings', loadComponent: () => import('./features/owner/settings.component').then(m => m.SettingsComponent) },
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless && npx ng build`
Expected: specs PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: owner settings for worker account and own password"
```

---

### Task 9: Worker dashboard with polling reminder banner

**Files:**
- Create: `frontend/src/app/features/worker/worker-dashboard.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (worker home route)
- Test: `frontend/src/app/features/worker/worker-dashboard.spec.ts`

**Interfaces:**
- Consumes: `BookingsApi.list({ from: daysAgoLocal(7) })`, `RemindersApi`, `todayLocal`, `daysAgoLocal`, shared UI.
- Produces: `/worker` — dismissible reminder banner polling every 60 s; sections **Today**, **Upcoming**, **Last 7 days (read-only)**; cards link to `/worker/bookings/:id`.

- [ ] **Step 1: Write the failing test**

`frontend/src/app/features/worker/worker-dashboard.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Booking } from '../../core/models';
import { WorkerDashboardComponent } from './worker-dashboard.component';

function booking(id: string, dayOffset: number): Booking {
  const start = new Date(Date.now() + dayOffset * 86_400_000);
  return {
    id, court_id: 'c1', customer_name: `Cust ${id}`, customer_phone: '9876543210',
    booking_date: start.toLocaleDateString('en-CA'),
    start_time: start.toISOString(), end_time: new Date(start.getTime() + 7_200_000).toISOString(),
    total_amount: '1000', status: 'confirmed', advance_forfeited: false,
    cancellation_reason: null, reminder_acknowledged: false, created_at: '', updated_at: '',
    balance_due: '500',
  };
}

describe('WorkerDashboardComponent', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkerDashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideRouter([])],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('groups bookings into today / upcoming / past and polls reminders every 60s', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkerDashboardComponent);
    fixture.detectChanges();
    tick();

    ctrl.expectOne((r) => r.url === '/api/bookings').flush([booking('past', -2), booking('today', 0), booking('future', 2)]);
    ctrl.expectOne('/api/reminders').flush([booking('today', 0)]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.today().length).toBe(1);
    expect(component.upcoming().length).toBe(1);
    expect(component.past().length).toBe(1);
    expect(component.reminders().length).toBe(1);

    tick(60_000);
    ctrl.expectOne('/api/reminders').flush([]);
    expect(component.reminders().length).toBe(0);

    discardPeriodicTasks();
  }));

  it('dismissing a reminder acks it and removes the banner', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkerDashboardComponent);
    fixture.detectChanges();
    tick();
    ctrl.expectOne((r) => r.url === '/api/bookings').flush([]);
    ctrl.expectOne('/api/reminders').flush([booking('soon', 0)]);
    fixture.detectChanges();

    fixture.componentInstance.dismiss(fixture.componentInstance.reminders()[0]);
    ctrl.expectOne('/api/reminders/soon/ack').flush({ ok: true });
    expect(fixture.componentInstance.reminders().length).toBe(0);

    discardPeriodicTasks();
  }));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `worker-dashboard.component.ts`**

```ts
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { switchMap, timer } from 'rxjs';
import { BookingsApi, RemindersApi } from '../../core/api';
import { daysAgoLocal, todayLocal } from '../../core/booking-time';
import { Booking } from '../../core/models';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';

const POLL_MS = 60_000;

@Component({
  selector: 'app-worker-dashboard',
  imports: [DatePipe, RouterLink, InrPipe, StatusChipComponent, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    @for (r of reminders(); track r.id) {
      <div class="banner">
        <mat-icon>alarm</mat-icon>
        <span><strong>{{ r.customer_name }}</strong> starts at {{ r.start_time | date: 'h:mm a' }}</span>
        <button mat-icon-button (click)="dismiss(r)" aria-label="Dismiss reminder"><mat-icon>close</mat-icon></button>
      </div>
    }

    <h3>Today</h3>
    @if (today().length === 0) { <p class="empty">No bookings today.</p> }
    <div class="cards">
      @for (b of today(); track b.id) {
        <mat-card appearance="outlined" [routerLink]="['/worker/bookings', b.id]">
          <mat-card-content>
            <div class="line"><strong>{{ b.customer_name }}</strong><status-chip [status]="b.status" /></div>
            <div>{{ b.start_time | date: 'h:mm a' }} – {{ b.end_time | date: 'h:mm a' }}</div>
            <div class="line"><span>{{ b.customer_phone }}</span><span>Due: {{ b.balance_due | inr }}</span></div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <h3>Upcoming</h3>
    @if (upcoming().length === 0) { <p class="empty">Nothing upcoming.</p> }
    <div class="cards">
      @for (b of upcoming(); track b.id) {
        <mat-card appearance="outlined" [routerLink]="['/worker/bookings', b.id]">
          <mat-card-content>
            <div class="line"><strong>{{ b.customer_name }}</strong><status-chip [status]="b.status" /></div>
            <div>{{ b.start_time | date: 'EEE d MMM, h:mm a' }}</div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <h3>Last 7 days <small>(read-only)</small></h3>
    <div class="cards">
      @for (b of past(); track b.id) {
        <mat-card appearance="outlined" class="muted" [routerLink]="['/worker/bookings', b.id]">
          <mat-card-content>
            <div class="line"><strong>{{ b.customer_name }}</strong><status-chip [status]="b.status" /></div>
            <div>{{ b.start_time | date: 'EEE d MMM, h:mm a' }}</div>
          </mat-card-content>
        </mat-card>
      } @empty { <p class="empty">No recent bookings.</p> }
    </div>
  `,
  styles: `
    .banner { display: flex; align-items: center; gap: 8px; background: #fff3e0; color: #a1490d;
              border: 1px solid #ffb74d; border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; }
    .banner span { flex: 1; }
    h3 { margin: 16px 0 8px; }
    .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    mat-card { cursor: pointer; }
    .muted { opacity: 0.75; }
    .line { display: flex; justify-content: space-between; align-items: center; }
    .empty { opacity: 0.6; }
  `,
})
export class WorkerDashboardComponent {
  private bookingsApi = inject(BookingsApi);
  private remindersApi = inject(RemindersApi);

  private bookings = signal<Booking[]>([]);
  reminders = signal<Booking[]>([]);

  today = computed(() => this.bookings().filter((b) => b.booking_date === todayLocal()));
  upcoming = computed(() => this.bookings().filter((b) => b.booking_date > todayLocal()));
  past = computed(() => this.bookings().filter((b) => b.booking_date < todayLocal()));

  constructor() {
    this.bookingsApi.list({ from: daysAgoLocal(7) }).pipe(takeUntilDestroyed())
      .subscribe((rows) => this.bookings.set(rows));
    timer(0, POLL_MS).pipe(switchMap(() => this.remindersApi.list()), takeUntilDestroyed())
      .subscribe((rows) => this.reminders.set(rows));
  }

  dismiss(booking: Booking): void {
    this.remindersApi.ack(booking.id).subscribe(() => {
      this.reminders.update((list) => list.filter((r) => r.id !== booking.id));
    });
  }
}
```

In `frontend/src/app/app.routes.ts`, add to worker children:

```ts
{ path: '', loadComponent: () => import('./features/worker/worker-dashboard.component').then(m => m.WorkerDashboardComponent) },
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless && npx ng build`
Expected: specs PASS, build succeeds.

- [ ] **Step 5: Manual check (needs backend running)**

`npm run dev`, log in as the seeded worker: today's bookings show as cards; create an owner booking starting in ~20 minutes (second browser tab as owner), see the banner appear within a minute, dismiss it, confirm it stays gone after reload.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: worker dashboard with grouped bookings and polling reminder banner"
```

---

### Task 10: Vercel deployment config, README, and UAT checklist

**Files:**
- Modify: `vercel.json`, root `package.json` (build script)
- Create: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a Vercel-deployable monorepo and the spec §10 README.

- [ ] **Step 1: Finalize `vercel.json`**

Replace the backend-only version with:

```json
{
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/dist/frontend/browser",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

Add to root `package.json` scripts:

```json
"build": "npm --prefix frontend install && npm --prefix frontend run build"
```

- [ ] **Step 2: Write `README.md`**

```markdown
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
cd frontend && npm test -- --watch=false --browsers=ChromeHeadless
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
```

- [ ] **Step 3: Full verification**

```bash
npm run test:api && npm run typecheck
cd frontend && npm test -- --watch=false --browsers=ChromeHeadless && npx ng build
```

Expected: everything green. Optionally `npx vercel build` locally to validate `vercel.json`.

- [ ] **Step 4: Manual UAT checklist (with the real owner & worker, per spec §9)**

- Owner: create → edit → cancel a booking; overlap rejected with the friendly message.
- Owner: reports show today's revenue and pending payments; chart renders on phone.
- Worker: sees today/upcoming, cannot see bookings older than 7 days, cannot edit anything.
- Worker: arrival → payment (cash & UPI) → extra item → complete, on a phone browser.
- Worker: reminder banner appears within a minute of the 30-min window and stays dismissed.
- Both: log out/in; deactivated worker cannot log in until re-activated by owner.

- [ ] **Step 5: Commit**

```bash
git add vercel.json package.json README.md
git commit -m "feat: vercel single-project deployment config and README"
```

---

## Done — V1 complete

All spec §5–§10 requirements are implemented, tested, and deployable. Remaining human steps: Vercel import, env vars, production seeding, UAT, and the handover checklist in the README.
