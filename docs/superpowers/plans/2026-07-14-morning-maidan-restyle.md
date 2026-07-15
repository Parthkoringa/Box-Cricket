# Morning Maidan Restyle + Demo Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved "Morning Maidan" visual identity (teal-led near-white palette, Bricolage Grotesque + Albert Sans, day-grouped dense booking rows, orchestrated CSS motion) across every screen, and add a wipeable demo-data seeder.

**Architecture:** All colors/shadows/radii become `--bc-*` CSS variables in `styles.scss`, which also maps Material's `--mat-sys-*` tokens onto them — so Material components inherit the palette without per-component fighting. Screen tasks then apply shared utility classes plus per-component styles. The only logic additions are a pure `groupByDay` helper, a `dayLabel` helper, a ~30-line rAF `CountUpDirective`, and per-list skeleton flags. `db/seed-demo.ts` mirrors `seed-users.ts` (Neon driver, parameterized SQL).

**Tech Stack:** Angular 22 (standalone, zoneless, Vitest — NO `@angular/animations`, NO zone.js, CSS-only motion + one rAF directive), Angular Material via system-token overrides, Chart.js/ng2-charts, `@neondatabase/serverless`.

**Spec:** `docs/superpowers/specs/2026-07-14-morning-maidan-restyle-design.md` — the design authority. Read §2 (tokens) and §5 (density) before any task.

## Global Constraints

- Palette EXACTLY as spec §2: `--bc-ink #1a2b31`, `--bc-muted #647b82`, `--bc-paper #fbfaf7`, `--bc-sand #f3ecdd`, `--bc-line #e8e3d6`, `--bc-card #ffffff`, `--bc-teal #0f4c5c`, `--bc-teal-deep #0a3844`, `--bc-teal-soft rgba(15,76,92,.08)`, `--bc-gold #e0a52e`, `--bc-green #2e7d4f`, `--bc-red #c4502c`, `--bc-grey #8a9296`. Gold appears ONLY at: wordmark accent, active-nav underline, arrived status, pending stat tile, reminder banner.
- Status/payment state is NEVER color-only: always a text label with the tint (spec §5 amendment).
- Fonts: Bricolage Grotesque (wordmark/headings/hero numbers), Albert Sans (body). No Roboto remains.
- All 66 existing frontend tests stay green after every task; `data-test` attributes and test-asserted strings (`Mark arrived`, `Cancel booking`, `Add payment`, section names, `₹…` renderings) are preserved. New helpers get new tests.
- Every animation is wrapped in `@media (prefers-reduced-motion: no-preference)`; `CountUpDirective` renders the final value instantly when `window.matchMedia` is unavailable (jsdom) or reduced motion is set — tests must never see intermediate values.
- No new npm dependencies. No backend/API changes. `frontend/` test command: `cd frontend && npm test -- --watch=false`; build: `npx ng build` (soft bundle warning is known/OK).
- Backend paths use the underscore layout (`api/_src`, `api/_test`) — `db/seed-demo.ts` imports nothing from `api/`.

---

### Task 1: Foundation — fonts, tokens, Material overrides, atmosphere, motion library

**Files:**
- Modify: `frontend/src/index.html` (font links)
- Modify: `frontend/src/styles.scss` (full rewrite below)

**Interfaces:**
- Produces (used by every later task): CSS variables `--bc-*` (list above); utility classes `.bc-card`, `.bc-pill` + `.bc-pill--confirmed|arrived|completed|cancelled|no_show`, `.bc-money`, `.bc-section-title`, `.bc-skeleton`, `.bc-stagger` (children auto-delayed), `.bc-fade-up`; keyframes `bc-fade-up`, `bc-shimmer`, `bc-ring`; font stacks via `--bc-font-display` / `--bc-font-body`.

- [ ] **Step 1: Swap fonts in `frontend/src/index.html`**

Replace the Roboto `<link>` (keep the two preconnect lines and the Material Icons link) with:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Albert+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 2: Rewrite `frontend/src/styles.scss`**

Replace the whole file with:

```scss
@use '@angular/material' as mat;

html {
  height: 100%;
  @include mat.theme((
    color: (primary: mat.$cyan-palette, tertiary: mat.$yellow-palette),
    typography: 'Albert Sans',
    density: 0,
  ));
}

:root {
  /* ---- Morning Maidan tokens (spec §2) ---- */
  --bc-ink: #1a2b31;
  --bc-muted: #647b82;
  --bc-paper: #fbfaf7;
  --bc-sand: #f3ecdd;
  --bc-line: #e8e3d6;
  --bc-card: #ffffff;
  --bc-teal: #0f4c5c;
  --bc-teal-deep: #0a3844;
  --bc-teal-soft: rgba(15, 76, 92, 0.08);
  --bc-gold: #e0a52e;
  --bc-gold-soft: rgba(224, 165, 46, 0.15);
  --bc-green: #2e7d4f;
  --bc-red: #c4502c;
  --bc-grey: #8a9296;
  --bc-shadow: 0 6px 18px rgba(15, 76, 92, 0.08);
  --bc-shadow-lift: 0 10px 26px rgba(15, 76, 92, 0.14);
  --bc-radius: 14px;
  --bc-font-display: 'Bricolage Grotesque', sans-serif;
  --bc-font-body: 'Albert Sans', sans-serif;

  /* ---- Map Material system tokens onto the palette ---- */
  --mat-sys-primary: var(--bc-teal);
  --mat-sys-on-primary: #fdfcfa;
  --mat-sys-primary-container: var(--bc-teal-soft);
  --mat-sys-on-primary-container: var(--bc-teal-deep);
  --mat-sys-surface: var(--bc-paper);
  --mat-sys-surface-container: var(--bc-card);
  --mat-sys-surface-container-high: var(--bc-card);
  --mat-sys-surface-container-highest: var(--bc-sand);
  --mat-sys-on-surface: var(--bc-ink);
  --mat-sys-on-surface-variant: var(--bc-muted);
  --mat-sys-outline: var(--bc-line);
  --mat-sys-outline-variant: var(--bc-line);
  --mat-sys-error: var(--bc-red);
  --mat-sys-corner-medium: 12px;
  --mat-sys-corner-large: var(--bc-radius);
}

body {
  color-scheme: light;
  margin: 0;
  height: 100%;
  color: var(--bc-ink);
  font-family: var(--bc-font-body);
  font-size: 14px;
  line-height: 1.5;
  background:
    radial-gradient(circle at 92% -4%, rgba(224, 165, 46, 0.10) 0 140px, transparent 170px),
    linear-gradient(165deg, #fdfcfa 0%, #f6f1e4 100%);
  background-attachment: fixed;
}

h1, h2, h3, h4 { font-family: var(--bc-font-display); color: var(--bc-teal); }

/* ---------- utility classes ---------- */
.bc-card {
  background: var(--bc-card);
  border-radius: var(--bc-radius);
  box-shadow: var(--bc-shadow);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.bc-card--hover:hover { transform: translateY(-2px); box-shadow: var(--bc-shadow-lift); }

.bc-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--bc-font-display);
  font-weight: 800;
  font-size: 15px;
  color: var(--bc-teal);
  margin: 18px 0 10px;
}
.bc-section-title::after {
  content: '';
  flex: 1;
  height: 1.5px;
  background: linear-gradient(90deg, var(--bc-line), transparent);
}

.bc-money {
  font-family: var(--bc-font-display);
  font-weight: 800;
  color: var(--bc-teal);
}

/* Labeled status pills — color is never the sole carrier (spec §5) */
.bc-pill {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.bc-pill--confirmed { background: var(--bc-teal-soft); color: var(--bc-teal); border: 1px solid rgba(15, 76, 92, 0.25); }
.bc-pill--arrived { background: var(--bc-gold-soft); color: #a3730a; border: 1px solid rgba(224, 165, 46, 0.45); }
.bc-pill--completed { background: rgba(46, 125, 79, 0.12); color: var(--bc-green); border: 1px solid rgba(46, 125, 79, 0.3); }
.bc-pill--cancelled { background: rgba(196, 80, 44, 0.10); color: var(--bc-red); border: 1px solid rgba(196, 80, 44, 0.3); }
.bc-pill--no_show { background: rgba(138, 146, 150, 0.12); color: #5c676c; border: 1px solid rgba(138, 146, 150, 0.35); }

/* Skeleton shimmer */
.bc-skeleton {
  border-radius: 10px;
  background: linear-gradient(90deg, var(--bc-sand) 25%, #faf6ec 45%, var(--bc-sand) 65%);
  background-size: 300% 100%;
  min-height: 44px;
}

/* ---------- motion (all gated on reduced-motion) ---------- */
@keyframes bc-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes bc-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@keyframes bc-ring {
  0%, 100% { transform: rotate(0); }
  8% { transform: rotate(14deg); } 16% { transform: rotate(-12deg); }
  24% { transform: rotate(8deg); } 32% { transform: rotate(0); }
}

@media (prefers-reduced-motion: no-preference) {
  .bc-fade-up { animation: bc-fade-up 0.35s ease-out both; }
  .bc-stagger > * { animation: bc-fade-up 0.35s ease-out both; }
  .bc-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .bc-stagger > *:nth-child(2) { animation-delay: 40ms; }
  .bc-stagger > *:nth-child(3) { animation-delay: 80ms; }
  .bc-stagger > *:nth-child(4) { animation-delay: 120ms; }
  .bc-stagger > *:nth-child(5) { animation-delay: 160ms; }
  .bc-stagger > *:nth-child(6) { animation-delay: 200ms; }
  .bc-stagger > *:nth-child(7) { animation-delay: 240ms; }
  .bc-stagger > *:nth-child(8) { animation-delay: 280ms; }
  .bc-stagger > *:nth-child(n + 9) { animation-delay: 320ms; }
  .bc-skeleton { animation: bc-shimmer 1.4s linear infinite; }
  .mat-mdc-unelevated-button, .mat-mdc-outlined-button, .mat-mdc-icon-button { transition: transform 0.1s ease; }
  .mat-mdc-unelevated-button:active, .mat-mdc-outlined-button:active { transform: scale(0.98); }
}

/* Material polish that tokens alone don't reach */
.mat-mdc-unelevated-button { font-family: var(--bc-font-display) !important; font-weight: 600 !important; letter-spacing: 0.01em; }
.mat-mdc-dialog-container .mdc-dialog__surface { border-radius: 18px !important; box-shadow: var(--bc-shadow-lift) !important; }
.mat-mdc-snack-bar-container .mdc-snackbar__surface { background: var(--bc-teal-deep) !important; border-radius: 10px !important; }
.mat-mdc-form-field { width: 100%; }
```

- [ ] **Step 3: Verify suite and build**

Run: `cd frontend && npm test -- --watch=false && npx ng build`
Expected: 66 tests pass (global CSS breaks no assertions); build succeeds.

- [ ] **Step 4: Visual smoke**

Run `npm run dev` at the repo root (frontend serves on 4200 — if the user's other project holds 4200, use `npm --prefix frontend run start -- --port 4201` plus `npm run dev:api`). Load the login page: dawn gradient visible, Albert Sans body font, no Roboto in DevTools network. Stop the servers.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.html frontend/src/styles.scss
git commit -m "feat(restyle): morning maidan tokens, fonts, material overrides, motion library"
```

---

### Task 2: Shared primitives — labeled status chip, dayLabel, groupByDay, CountUpDirective

**Files:**
- Modify: `frontend/src/app/shared/status-chip.component.ts`
- Modify: `frontend/src/app/core/booking-time.ts` (add `dayLabel`)
- Create: `frontend/src/app/core/booking-groups.ts`
- Create: `frontend/src/app/shared/count-up.directive.ts`
- Test: `frontend/src/app/core/booking-groups.spec.ts`, `frontend/src/app/shared/count-up.spec.ts`; extend `frontend/src/app/core/booking-time.spec.ts`

**Interfaces:**
- Consumes: `Booking` model; `.bc-pill` classes (Task 1).
- Produces:
  - `StatusChipComponent` — same selector/inputs, renders `.bc-pill bc-pill--<status>` with the SAME label texts (`Confirmed`, `Arrived`, `Completed`, `Cancelled`, `No-show`).
  - `dayLabel(date: string, today: string): string` — `'Today'` when equal, `'Tomorrow'` when +1 day, else e.g. `'Fri 18 Jul'` (en-GB weekday+day+month, no year).
  - `groupByDay(bookings: Booking[], today: string): DayGroup[]` where `DayGroup = { date: string; label: string; bookings: Booking[]; count: number; totalDue: number }` — preserves input order, groups consecutive same-date bookings, `totalDue` sums `Number(balance_due ?? 0)` for non-cancelled/no-show bookings.
  - `CountUpDirective` — `<b [bcCountUp]="1234" [bcPrefix]="'₹'">`; animates 0→value over 800ms via rAF, en-IN grouping; renders final value INSTANTLY when `window.matchMedia` is undefined (jsdom) or `(prefers-reduced-motion: reduce)` matches.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/app/core/booking-time.spec.ts` (inside the top describe):

```ts
describe('dayLabel', () => {
  it('labels today, tomorrow, and other days', () => {
    expect(dayLabel('2026-07-14', '2026-07-14')).toBe('Today');
    expect(dayLabel('2026-07-15', '2026-07-14')).toBe('Tomorrow');
    expect(dayLabel('2026-07-18', '2026-07-14')).toBe('Sat 18 Jul');
  });
});
```

(add `dayLabel` to the import from `./booking-time`.)

`frontend/src/app/core/booking-groups.spec.ts`:

```ts
import { Booking } from './models';
import { groupByDay } from './booking-groups';

function b(id: string, date: string, due: string | undefined, status: Booking['status'] = 'confirmed'): Booking {
  return {
    id, court_id: 'c', customer_name: id, customer_phone: '9', booking_date: date,
    start_time: `${date}T18:00:00.000Z`, end_time: `${date}T20:00:00.000Z`,
    total_amount: '1000', status, advance_forfeited: false, cancellation_reason: null,
    reminder_acknowledged: false, created_at: '', updated_at: '', balance_due: due,
  };
}

describe('groupByDay', () => {
  it('groups consecutive dates, labels them, counts and sums due', () => {
    const groups = groupByDay(
      [b('a', '2026-07-14', '500'), b('c', '2026-07-14', '200', 'cancelled'), b('d', '2026-07-15', '700')],
      '2026-07-14',
    );
    expect(groups.length).toBe(2);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].count).toBe(2);
    expect(groups[0].totalDue).toBe(500); // cancelled excluded from due
    expect(groups[1].label).toBe('Tomorrow');
    expect(groups[1].bookings[0].id).toBe('d');
  });

  it('returns empty array for no bookings', () => {
    expect(groupByDay([], '2026-07-14')).toEqual([]);
  });
});
```

`frontend/src/app/shared/count-up.spec.ts`:

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CountUpDirective } from './count-up.directive';

@Component({ imports: [CountUpDirective], template: `<b [bcCountUp]="5400" bcPrefix="₹"></b>` })
class HostComponent {}

describe('CountUpDirective', () => {
  it('renders the final formatted value instantly in jsdom (no matchMedia)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('₹5,400');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- --watch=false`
Expected: FAIL — `dayLabel`/`booking-groups`/`count-up.directive` don't exist.

- [ ] **Step 3: Implement**

Append to `frontend/src/app/core/booking-time.ts`:

```ts
/** 'Today' / 'Tomorrow' / 'Sat 18 Jul' — labels for day-group headers. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const next = new Date(`${today}T12:00:00`);
  next.setDate(next.getDate() + 1);
  if (date === next.toLocaleDateString('en-CA')) return 'Tomorrow';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}
```

`frontend/src/app/core/booking-groups.ts`:

```ts
import { dayLabel } from './booking-time';
import { Booking } from './models';

export interface DayGroup {
  date: string;
  label: string;
  bookings: Booking[];
  count: number;
  totalDue: number;
}

const NO_DUE: Booking['status'][] = ['cancelled', 'no_show'];

/** Groups bookings (already sorted by start_time) into per-day sections. */
export function groupByDay(bookings: Booking[], today: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const booking of bookings) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== booking.booking_date) {
      group = { date: booking.booking_date, label: dayLabel(booking.booking_date, today), bookings: [], count: 0, totalDue: 0 };
      groups.push(group);
    }
    group.bookings.push(booking);
    group.count++;
    if (!NO_DUE.includes(booking.status)) group.totalDue += Number(booking.balance_due ?? 0);
  }
  return groups;
}
```

`frontend/src/app/shared/count-up.directive.ts`:

```ts
import { Directive, ElementRef, Input, OnChanges, inject } from '@angular/core';

const DURATION_MS = 800;

@Directive({ selector: '[bcCountUp]' })
export class CountUpDirective implements OnChanges {
  @Input({ required: true }) bcCountUp: number | string = 0;
  @Input() bcPrefix = '';

  private el = inject(ElementRef<HTMLElement>);

  ngOnChanges(): void {
    const target = Number(this.bcCountUp ?? 0);
    const reduced =
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !Number.isFinite(target)) {
      this.render(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      this.render(target * (1 - Math.pow(1 - t, 3))); // ease-out cubic
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private render(value: number): void {
    this.el.nativeElement.textContent =
      this.bcPrefix + Math.round(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
}
```

Replace `frontend/src/app/shared/status-chip.component.ts`'s template/styles (keep selector, `LABELS`, `@Input status`, and label TEXTS unchanged):

```ts
@Component({
  selector: 'status-chip',
  template: `<span class="bc-pill bc-pill--{{ status }}">{{ label }}</span>`,
  styles: ``,
})
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npm test -- --watch=false`
Expected: all pass (66 + 4 new = 70).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared frontend/src/app/core
git commit -m "feat(restyle): labeled status pills, day grouping helpers, count-up directive"
```

---

### Task 3: Login hero + owner/worker shell headers

**Files:**
- Modify: `frontend/src/app/features/login/login.component.ts`
- Modify: `frontend/src/app/features/owner/owner-shell.component.ts`
- Modify: `frontend/src/app/features/worker/worker-shell.component.ts`

**Interfaces:**
- Consumes: tokens/utilities (Task 1). No logic changes anywhere — `form`, `submit()`, `auth.logout()`, routerLinks, and all visible strings (`Sign in`, nav labels `Bookings/Reports/Settings`) stay.

- [ ] **Step 1: Restyle the login into the hero**

In `login.component.ts`, replace template/styles ONLY (component class untouched). Template:

```html
<div class="wrap bc-stagger">
  <div class="sun" aria-hidden="true"></div>
  <h1 class="brand">Box<em>Cricket</em></h1>
  <p class="tag">Ground bookings, payments &amp; match-day ops</p>
  <mat-card appearance="outlined">
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
```

Styles:

```scss
.wrap { display: flex; flex-direction: column; align-items: center; padding: 13vh 16px 0; }
.sun {
  width: 64px; height: 64px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #f5c96a, var(--bc-gold));
  box-shadow: 0 0 60px 18px rgba(224, 165, 46, 0.30);
  margin-bottom: 14px;
}
.brand { font-size: 34px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
.brand em { font-style: normal; color: var(--bc-gold); }
.tag { color: var(--bc-muted); font-size: 13px; margin: 4px 0 22px; }
mat-card { width: 100%; max-width: 340px; border: none; border-radius: 20px; box-shadow: var(--bc-shadow-lift); }
form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
button { border-radius: 12px; padding: 22px 0; font-size: 15px; }
.error { color: var(--bc-red); margin: 8px 0 0; }
@media (prefers-reduced-motion: no-preference) {
  .sun { animation: bc-fade-up 0.5s ease-out both; }
}
```

- [ ] **Step 2: Restyle both shell headers**

`owner-shell.component.ts` — replace template/styles only. Template keeps the same links/logout handler; wordmark becomes `<span class="logo">Box<em>Cricket</em></span>`; wrap nav links unchanged in text. Styles:

```scss
mat-toolbar {
  background: rgba(253, 252, 250, 0.8);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--bc-line);
  color: var(--bc-ink);
  gap: 14px;
}
.logo { font-family: var(--bc-font-display); font-weight: 800; font-size: 18px; color: var(--bc-teal); margin-right: 8px; }
.logo em { font-style: normal; color: var(--bc-gold); }
nav { display: flex; overflow-x: auto; }
nav a { color: var(--bc-muted); font-weight: 500; position: relative; }
nav a.active { color: var(--bc-teal); font-weight: 700; }
nav a.active::after {
  content: ''; position: absolute; left: 14px; right: 14px; bottom: 4px;
  height: 2px; background: var(--bc-gold); border-radius: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  nav a::after { transition: left 0.2s ease, right 0.2s ease; }
}
.spacer { flex: 1; }
main { padding: 16px; max-width: 1100px; margin: 0 auto; }
@media (max-width: 600px) { .logo { font-size: 16px; } main { padding: 8px; } }
```

`worker-shell.component.ts` — same header treatment (logo + blur + hairline), keep `{{ auth.user?.name }}` and logout button; add `main { padding: 12px; max-width: 800px; margin: 0 auto; }` and the ≤600px condensation.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm test -- --watch=false && npx ng build`
Expected: 70 pass, build green.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features
git commit -m "feat(restyle): login hero and translucent shell headers"
```

---

### Task 4: Owner bookings list — day-grouped dense rows + skeletons

**Files:**
- Modify: `frontend/src/app/features/owner/bookings-list.component.ts`

**Interfaces:**
- Consumes: `groupByDay`/`DayGroup`, `todayLocal`, `StatusChipComponent`, `InrPipe`, `.bc-*` utilities. Filters (`date`, `status`, `q` + debounce), `load()`, `newBooking()` (dialog + snackbar `Booking created`) all keep their existing logic.
- Produces: the dense-row pattern (`.day-head`, `.rows`, `.row`, `.rail`) that Task 7 reuses on the worker dashboard.

- [ ] **Step 1: Rework the component**

Add to the class (keep everything existing):

```ts
loading = signal(true);
groups = computed(() => groupByDay(this.bookings(), todayLocal()));
```

Set `loading` in `load()`:

```ts
load(): void {
  this.loading.set(true);
  this.api.list({
    date: this.date.value || undefined,
    status: this.status.value || undefined,
    q: this.q.value || undefined,
  }).subscribe({
    next: (rows) => { this.bookings.set(rows); this.loading.set(false); },
    error: () => { this.loading.set(false); this.snack.open('Could not load bookings', undefined, { duration: 4000 }); },
  });
}
```

Add a payment-state helper to the class (words, never color alone):

```ts
paymentLabel(b: Booking): { text: string; cls: string } {
  if (b.status === 'cancelled') return { text: b.advance_forfeited ? 'FORFEITED' : 'CANCELLED', cls: 'red' };
  if (b.status === 'no_show') return { text: 'FORFEITED', cls: 'red' };
  if (Number(b.balance_due ?? 0) <= 0) return { text: 'PAID', cls: 'green' };
  return { text: '', cls: '' };
}
```

- [ ] **Step 2: Replace the template** (filters block unchanged; cards grid replaced):

```html
@if (loading()) {
  <div class="bc-stagger">
    <div class="bc-skeleton" style="margin-bottom:8px"></div>
    <div class="bc-skeleton" style="margin-bottom:8px"></div>
    <div class="bc-skeleton"></div>
  </div>
} @else if (groups().length === 0) {
  <div class="empty bc-fade-up">
    <span class="empty-ic"><mat-icon>sports_cricket</mat-icon></span>
    <p>No bookings match.</p>
  </div>
} @else {
  @for (g of groups(); track g.date) {
    <div class="day-head">
      <b>{{ g.label }}</b>
      <span>{{ g.date | date: 'EEE d MMM' }}</span>
      <i>{{ g.count }} booking{{ g.count === 1 ? '' : 's' }}@if (g.totalDue > 0) { · {{ g.totalDue | inr }} due}</i>
    </div>
    <div class="rows bc-card bc-stagger">
      @for (b of g.bookings; track b.id) {
        <div class="row" [routerLink]="['/owner/bookings', b.id]">
          <div class="rail">
            {{ b.start_time | date: 'h:mm' }}
            <small>{{ b.end_time | date: 'h:mm a' }}</small>
          </div>
          <div class="t">
            <div class="who">{{ b.customer_name }}</div>
            <div class="ph">{{ b.customer_phone }}</div>
          </div>
          <status-chip [status]="b.status" />
          @if (paymentLabel(b).text) {
            <span class="pay" [class]="paymentLabel(b).cls">{{ paymentLabel(b).text }}</span>
          } @else {
            <span class="due bc-money">{{ b.balance_due | inr }}<small>due</small></span>
          }
        </div>
      }
    </div>
  }
}
```

- [ ] **Step 3: Replace the styles** (keep `.filters` rules, restyle chips inputs lightly):

```scss
.filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 4px; }
.filters .grow { flex: 1; min-width: 180px; }
.day-head {
  position: sticky; top: 0; z-index: 1;
  display: flex; align-items: baseline; gap: 8px;
  padding: 12px 4px 7px;
  background: linear-gradient(180deg, #f8f4ea 70%, transparent);
}
.day-head b { font-family: var(--bc-font-display); font-weight: 800; font-size: 15px; color: var(--bc-teal); }
.day-head span { font-size: 11px; color: var(--bc-muted); }
.day-head i { font-style: normal; margin-left: auto; font-size: 11.5px; color: var(--bc-muted); }
.rows { overflow: hidden; margin-bottom: 6px; }
.row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 14px; cursor: pointer;
  border-bottom: 1px solid #f1ede2;
  transition: background 0.12s ease;
}
.row:last-child { border-bottom: none; }
.row:hover { background: var(--bc-teal-soft); }
.rail {
  width: 62px; flex: none; text-align: center; line-height: 1.25;
  font-family: var(--bc-font-display); font-weight: 700; font-size: 13px; color: var(--bc-teal);
  border-right: 2px solid var(--bc-sand); padding-right: 10px;
}
.rail small { display: block; font-family: var(--bc-font-body); font-weight: 400; font-size: 10.5px; color: var(--bc-muted); }
.t { flex: 1; min-width: 0; }
.who { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph { color: var(--bc-muted); font-size: 11px; }
.due { font-size: 15px; min-width: 62px; text-align: right; }
.due small { display: block; font-family: var(--bc-font-body); font-weight: 400; font-size: 9.5px; letter-spacing: 0.1em; color: var(--bc-muted); text-transform: uppercase; }
.pay { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; min-width: 62px; text-align: right; }
.pay.green { color: var(--bc-green); }
.pay.red { color: var(--bc-red); }
.empty { text-align: center; padding: 40px 0; color: var(--bc-muted); }
.empty-ic {
  display: inline-flex; width: 56px; height: 56px; border-radius: 50%;
  background: var(--bc-sand); align-items: center; justify-content: center; color: var(--bc-teal);
}
@media (max-width: 600px) {
  .ph { display: none; }
  .rail { width: 50px; }
}
```

Imports: add `MatIconModule`, `computed`, `groupByDay`, `todayLocal` as needed; `DatePipe` already imported.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test -- --watch=false && npx ng build`
Expected: 70 pass (this component has no spec of its own; dialog specs unaffected), build green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/owner/bookings-list.component.ts
git commit -m "feat(restyle): day-grouped dense booking rows with skeletons and empty state"
```

---

### Task 5: Booking detail — hero header, balance triptych, sectioned lists

**Files:**
- Modify: `frontend/src/app/features/bookings/booking-detail.component.ts`
- Modify: `frontend/src/app/features/bookings/payment-dialog.component.ts`, `item-dialog.component.ts`, `cancel-dialog.component.ts` (style blocks only)

**Interfaces:**
- Consumes: tokens/utilities; ALL existing behavior, button labels (`Mark arrived`, `Mark completed`, `No-show`, `Edit`, `Cancel booking`, `Add payment`, `Add item`), `data-test="delete-payment"` / `data-test="delete-item"`, `can()` gating — unchanged. The 4 booking-detail tests must pass untouched.

- [ ] **Step 1: Restyle the detail component** — template keeps every element/binding; changes are class additions and layout wrappers:

Wrap the three cards in a `<div class="bc-stagger">`; give each `mat-card` the classes `bc-card` (appearance stays `outlined`, add `class="bc-card"`). Replace the balances block markup with the triptych:

```html
<div class="balances">
  <div><span>Total due</span><strong class="bc-money">{{ b.total_due | inr }}</strong></div>
  <div><span>Paid</span><strong class="bc-money green">{{ b.total_paid | inr }}</strong></div>
  <div class="hero"><span>Balance</span><strong class="bc-money">{{ b.balance_due | inr }}</strong></div>
</div>
```

Replace the component styles with:

```scss
:host { display: flex; flex-direction: column; gap: 12px; }
mat-card { border: none; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
h2 { margin: 0; font-size: 24px; font-weight: 800; }
h3 { margin: 0; font-size: 15px; font-weight: 800; }
.balances {
  display: flex; gap: 10px; margin: 14px 0; flex-wrap: wrap;
}
.balances > div {
  flex: 1; min-width: 90px;
  background: var(--bc-paper); border: 1px solid var(--bc-line);
  border-radius: 12px; padding: 10px 12px;
  display: flex; flex-direction: column;
}
.balances > div.hero { background: var(--bc-teal-soft); border-color: rgba(15, 76, 92, 0.2); }
.balances span { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bc-muted); font-weight: 700; }
.balances strong { font-size: 22px; }
.balances strong.green { color: var(--bc-green); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.actions button { border-radius: 10px; }
.rowline {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid #f1ede2;
}
.rowline:last-of-type { border-bottom: none; }
.amount { display: flex; align-items: center; gap: 4px; font-family: var(--bc-font-display); font-weight: 700; color: var(--bc-teal); }
.forfeit { color: var(--bc-red); font-weight: 700; }
.empty { color: var(--bc-muted); }
```

- [ ] **Step 2: Restyle the three dialogs** — style blocks only: form gap 10px, `mat-dialog-title` font-family `var(--bc-font-display)` weight 800 color teal, action buttons `border-radius: 10px`. Cancel dialog's confirm button additionally: `background: var(--bc-red); color: #fff;` (destructive is red, not gold).

- [ ] **Step 3: Verify**

Run: `cd frontend && npm test -- --watch=false && npx ng build`
Expected: 70 pass (detail tests assert labels/₹540/delete counts — all preserved).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/bookings
git commit -m "feat(restyle): booking detail hero balances and styled dialogs"
```

---

### Task 6: Reports — stat tiles with count-up, gradient chart, styled pending table

**Files:**
- Modify: `frontend/src/app/features/owner/reports.component.ts`

**Interfaces:**
- Consumes: `CountUpDirective` (Task 2), tokens. Data flow (`load()`, `summary`, `pending`, `trends` → `setChart`) unchanged. The reports spec asserts `'₹5,400'` and `'₹300'` in textContent — CountUp renders instantly in jsdom (no matchMedia), so assertions hold, BUT the spec text uses the inr pipe's format; keep prefix `'₹'` and en-IN grouping identical.

- [ ] **Step 1: Stat tiles** — replace the summary cards block:

```html
@if (summary(); as s) {
  <div class="statgrid bc-stagger">
    <div class="stat bc-card"><small>Revenue</small><b [bcCountUp]="s.revenue" bcPrefix="₹"></b></div>
    <div class="stat bc-card gold"><small>Forfeited advances</small><b [bcCountUp]="s.forfeited_advances" bcPrefix="₹"></b></div>
    <div class="stat bc-card"><small>Completed</small><b [bcCountUp]="s.bookings.completed ?? 0"></b></div>
    <div class="stat bc-card"><small>Cancelled / no-show</small><b [bcCountUp]="(s.bookings.cancelled ?? 0) + (s.bookings.no_show ?? 0)"></b></div>
  </div>
}
```

NOTE the spec test asserts `'₹5,400'` and `'₹300'`: `Number('5400').toLocaleString('en-IN')` → `5,400` ✓ and `'₹' + 300` → `₹300` ✓.

- [ ] **Step 2: Chart gradient** — in `setChart`, style the datasets (no new libs; guard for jsdom's null canvas context):

```ts
private setChart(points: TrendPoint[]): void {
  this.chartData = {
    labels: points.map((p) => p.day),
    datasets: [
      {
        label: 'Revenue (₹)', data: points.map((p) => Number(p.revenue)), yAxisID: 'y',
        tension: 0.35, borderColor: '#0f4c5c', borderWidth: 2.5, pointRadius: 0, fill: true,
        backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D | null; height: number } }) => {
          const c = ctx.chart.ctx;
          if (!c || typeof c.createLinearGradient !== 'function') return 'rgba(15,76,92,.15)';
          const g = c.createLinearGradient(0, 0, 0, ctx.chart.height || 200);
          g.addColorStop(0, 'rgba(15,76,92,.30)');
          g.addColorStop(1, 'rgba(15,76,92,0)');
          return g;
        },
      },
      {
        label: 'Bookings', data: points.map((p) => p.bookings), yAxisID: 'bookings',
        tension: 0.35, borderColor: '#e0a52e', borderWidth: 2, pointRadius: 0, borderDash: [5, 4],
      },
    ],
  };
}
```

- [ ] **Step 3: Styles** — replace `.cards`/table styles:

```scss
:host { display: flex; flex-direction: column; gap: 12px; }
.range { display: flex; gap: 8px; flex-wrap: wrap; }
.statgrid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.stat { padding: 14px 16px; position: relative; overflow: hidden; display: flex; flex-direction: column; }
.stat::after {
  content: ''; position: absolute; right: -18px; top: -18px;
  width: 54px; height: 54px; border-radius: 50%; background: var(--bc-teal-soft);
}
.stat small { font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--bc-muted); font-weight: 700; margin-bottom: 5px; }
.stat b { font-family: var(--bc-font-display); font-weight: 800; font-size: 26px; color: var(--bc-teal); }
.stat.gold b { color: var(--bc-gold); }
.stat.gold::after { background: var(--bc-gold-soft); }
mat-card { border: none; }
h3 { margin: 0 0 8px; font-size: 15px; font-weight: 800; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 8px; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--bc-teal); border-bottom: 2px solid var(--bc-sand); white-space: nowrap; }
td { text-align: left; padding: 9px 8px; border-bottom: 1px solid #f1ede2; white-space: nowrap; font-size: 13px; }
tbody tr { cursor: pointer; transition: background 0.12s ease; }
tbody tr:hover { background: var(--bc-teal-soft); }
.empty { color: var(--bc-muted); text-align: center; }
```

Imports: add `CountUpDirective` to the component imports array.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test -- --watch=false && npx ng build`
Expected: 70 pass — including the existing reports spec (instant count-up render in jsdom).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/owner/reports.component.ts
git commit -m "feat(restyle): report stat tiles with count-up and gradient trends chart"
```

---

### Task 7: Worker dashboard — gold banner, today cards, dense groups + settings restyle

**Files:**
- Modify: `frontend/src/app/features/worker/worker-dashboard.component.ts`
- Modify: `frontend/src/app/features/owner/settings.component.ts` (styles only)

**Interfaces:**
- Consumes: `groupByDay`, `todayLocal`, dense-row pattern (Task 4), tokens, `.bc-*`. Component signals (`reminders`, `today`, `upcoming`, `past`), `dismiss()`, polling, and section heading TEXTS (`Today`, `Upcoming`, `Last 7 days`) unchanged — the 2 worker specs assert component state and must pass untouched.

- [ ] **Step 1: Worker dashboard template** — keep all @for/@if logic and handlers; changes:

Banner becomes:

```html
@for (r of reminders(); track r.id) {
  <div class="banner bc-fade-up">
    <mat-icon class="bell">alarm</mat-icon>
    <span><strong>{{ r.customer_name }}</strong> starts at {{ r.start_time | date: 'h:mm a' }} — get the court ready</span>
    <button mat-icon-button (click)="dismiss(r)" aria-label="Dismiss reminder"><mat-icon>close</mat-icon></button>
  </div>
}
```

`Today` section keeps cards but restyled (`mat-card` → add `class="bc-card bc-card--hover"`, balance uses `.bc-money`). Replace the `Upcoming` and `Last 7 days` card grids with the dense-row pattern from Task 4 — same `.rows/.row/.rail/.who/.ph` classes and markup, rows `[routerLink]="['/worker/bookings', b.id]"`, with `groupByDay(upcoming(), todayLocal())` / `groupByDay(past(), todayLocal())` (add `upcomingGroups = computed(...)`, `pastGroups = computed(...)` to the class). Past rows keep the muted look via a `.done` class (opacity .68). Section headings use `<h3 class="bc-section-title">` with the exact texts `Today`, `Upcoming`, `Last 7 days <small>(read-only)</small>`.

- [ ] **Step 2: Worker dashboard styles** — the dense-row block (identical classes to the owner list; component-scoped so repeat it here), plus banner/cards:

```scss
.rows { overflow: hidden; margin-bottom: 6px; }
.row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 14px; cursor: pointer;
  border-bottom: 1px solid #f1ede2;
  transition: background 0.12s ease;
}
.row:last-child { border-bottom: none; }
.row:hover { background: var(--bc-teal-soft); }
.rail {
  width: 62px; flex: none; text-align: center; line-height: 1.25;
  font-family: var(--bc-font-display); font-weight: 700; font-size: 13px; color: var(--bc-teal);
  border-right: 2px solid var(--bc-sand); padding-right: 10px;
}
.rail small { display: block; font-family: var(--bc-font-body); font-weight: 400; font-size: 10.5px; color: var(--bc-muted); }
.t { flex: 1; min-width: 0; }
.who { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph { color: var(--bc-muted); font-size: 11px; }
.day-head {
  position: sticky; top: 0; z-index: 1;
  display: flex; align-items: baseline; gap: 8px;
  padding: 12px 4px 7px;
  background: linear-gradient(180deg, #f8f4ea 70%, transparent);
}
.day-head b { font-family: var(--bc-font-display); font-weight: 800; font-size: 15px; color: var(--bc-teal); }
.day-head span { font-size: 11px; color: var(--bc-muted); }
.day-head i { font-style: normal; margin-left: auto; font-size: 11.5px; color: var(--bc-muted); }
@media (max-width: 600px) { .ph { display: none; } .rail { width: 50px; } }
```

And:

```scss
.banner {
  display: flex; align-items: center; gap: 10px;
  background: linear-gradient(95deg, var(--bc-gold) 0%, #ecc25e 100%);
  color: #3d2c00; border-radius: 14px; padding: 10px 14px; margin-bottom: 10px;
  box-shadow: 0 6px 18px var(--bc-gold-soft); font-size: 13.5px;
}
.banner strong { font-weight: 700; }
.banner span { flex: 1; }
.banner button { color: #3d2c00; }
@media (prefers-reduced-motion: no-preference) {
  .bell { animation: bc-ring 2.2s ease-in-out infinite; }
}
.cards { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.row.done { opacity: 0.68; }
```

- [ ] **Step 3: Settings styles** — replace the style block: cards get `border: none; box-shadow: var(--bc-shadow); border-radius: var(--bc-radius);`, titles Bricolage 800 teal, buttons `border-radius: 10px`, keep layout/forms untouched.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test -- --watch=false && npx ng build`
Expected: 70 pass (worker specs assert signals + HTTP, not markup), build green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/worker frontend/src/app/features/owner/settings.component.ts
git commit -m "feat(restyle): worker dashboard banner, dense groups, settings polish"
```

---

### Task 8: Demo data seeder with wipe mode

**Files:**
- Create: `db/seed-demo.ts`
- Modify: root `package.json` (add script `"seed:demo": "tsx db/seed-demo.ts"`)

**Interfaces:**
- Consumes: `DATABASE_URL` env; existing users (from `seed:users`) and the seeded court. Standalone — imports nothing from `api/`.
- Produces: `npm run seed:demo` (idempotent-ish: wipes bookings first, then seeds ~28) and `npm run seed:demo -- --wipe` (wipe only).

- [ ] **Step 1: Write `db/seed-demo.ts`**

```ts
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const sql = neon(required('DATABASE_URL'));
const IST = 'Asia/Kolkata';
const HOUR = 3_600_000;
const DAY = 86_400_000;

const istDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: IST });

/** A slot `days` days from now starting at `hour` IST (0-23), `len` hours long. */
function slot(days: number, hour: number, len = 2) {
  const now = new Date();
  const base = new Date(now.getTime() + days * DAY);
  const [y, m, d] = istDate(base).split('-').map(Number);
  // IST is UTC+5:30 fixed — construct the UTC instant for that IST wall time
  const start = new Date(Date.UTC(y, m - 1, d, hour - 5, -30));
  return { date: istDate(start), start, end: new Date(start.getTime() + len * HOUR) };
}

const NAMES = [
  ['Ravi Patel', '9898012340'], ['Suresh Shah', '9909055511'], ['Kiran Mehta', '9737088220'],
  ['Amit Desai', '9824071119'], ['Night Owls CC', '9090930303'], ['Parekh Brothers', '9811044556'],
  ['Galaxy Traders XI', '9427314151'], ['Morning Regulars', '9016162626'], ['Jay Thakor', '9725501122'],
  ['Vivek & Friends', '9313972648'], ['Sunrise Strikers', '9879811223'], ['Hardik Joshi', '9265307781'],
] as const;
let n = 0;
const who = () => NAMES[n++ % NAMES.length];

const ITEMS: Array<[string, number, number]> = [
  ['Water bottle', 4, 20], ['Snacks', 2, 50], ['Tape ball', 1, 60], ['Energy drink', 2, 80],
];

async function main() {
  const wipeOnly = process.argv.includes('--wipe');
  await sql.query('TRUNCATE bookings CASCADE');
  console.log('Cleared all bookings (payments/items cascade).');
  if (wipeOnly) return;

  const owners = await sql.query(`SELECT id, role FROM users`);
  const owner = owners.find((u: Record<string, unknown>) => u['role'] === 'owner');
  const worker = owners.find((u: Record<string, unknown>) => u['role'] === 'worker');
  if (!owner || !worker) throw new Error('Owner/worker accounts missing — run `npm run seed:users` first.');
  const courts = await sql.query('SELECT id FROM courts LIMIT 1');
  if (!courts[0]) throw new Error('No court found — apply db/schema.sql first.');
  const court = courts[0]['id'];

  let count = 0;
  async function booking(opts: {
    days: number; hour: number; len?: number; total: number;
    status?: 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';
    advance?: number; remaining?: boolean; items?: number; reason?: string;
    startAt?: Date; endAt?: Date; date?: string;
  }) {
    const s = opts.startAt ? { date: opts.date!, start: opts.startAt, end: opts.endAt! } : slot(opts.days, opts.hour, opts.len);
    const [name, phone] = who();
    const status = opts.status ?? 'confirmed';
    const forfeited = status === 'cancelled' || status === 'no_show';
    const rows = await sql.query(
      `INSERT INTO bookings (court_id, customer_name, customer_phone, booking_date, start_time, end_time,
        total_amount, status, advance_forfeited, cancellation_reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [court, name, phone, s.date, s.start.toISOString(), s.end.toISOString(),
       opts.total, status, forfeited, opts.reason ?? null, owner!['id']],
    );
    const id = rows[0]['id'];
    if (opts.advance) {
      await sql.query(
        `INSERT INTO payments (booking_id, amount, type, method, collected_by, paid_at)
         VALUES ($1,$2,'advance',$3,$4,$5)`,
        [id, opts.advance, count % 2 ? 'upi' : 'cash', owner!['id'],
         new Date(s.start.getTime() - 2 * DAY).toISOString()],
      );
    }
    let itemsTotal = 0;
    for (let i = 0; i < (opts.items ?? 0); i++) {
      const [item, qty, price] = ITEMS[(count + i) % ITEMS.length];
      itemsTotal += qty * price;
      await sql.query(
        `INSERT INTO booking_items (booking_id, item_name, quantity, unit_price, added_by, added_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, item, qty, price, worker!['id'], new Date(s.start.getTime() + HOUR).toISOString()],
      );
    }
    if (opts.remaining) {
      await sql.query(
        `INSERT INTO payments (booking_id, amount, type, method, collected_by, paid_at)
         VALUES ($1,$2,'remaining',$3,$4,$5)`,
        [id, opts.total + itemsTotal - (opts.advance ?? 0), count % 3 ? 'cash' : 'upi', worker!['id'],
         new Date(s.end.getTime()).toISOString()],
      );
    }
    count++;
  }

  // -- past 14 days: completed games with full trails (2/day-ish), varied hours
  for (let d = 14; d >= 2; d -= 2) {
    await booking({ days: -d, hour: 7, total: 900 + (d % 3) * 100, status: 'completed', advance: 300, remaining: true, items: d % 2 });
    await booking({ days: -d, hour: 20, total: 1200, status: 'completed', advance: 400, remaining: true, items: (d + 1) % 3 });
  }
  // completed but balance still due (pending report)
  await booking({ days: -3, hour: 18, total: 1000, status: 'completed', advance: 400, items: 1 });
  await booking({ days: -1, hour: 21, total: 1400, status: 'completed', advance: 500 });
  // cancelled + no-show with forfeited advances
  await booking({ days: -5, hour: 16, total: 1000, status: 'cancelled', advance: 300, reason: 'Rain — customer called off' });
  await booking({ days: -2, hour: 17, total: 1200, status: 'cancelled', advance: 400, reason: 'Team short of players' });
  await booking({ days: -4, hour: 22, total: 1000, status: 'no_show', advance: 300 });
  // today: ALL relative to run time so the exclusion constraint can never fire
  const nowIst = new Date();
  const rel = (fromMin: number, toMin: number) => ({
    days: 0, hour: 0,
    date: istDate(new Date(nowIst.getTime() + fromMin * 60_000)),
    startAt: new Date(nowIst.getTime() + fromMin * 60_000),
    endAt: new Date(nowIst.getTime() + toMin * 60_000),
  });
  // finished 2h ago
  await booking({ ...rel(-240, -120), total: 900, status: 'completed', advance: 300, remaining: true, items: 1 });
  // in progress, ends in 15 min (gap of 10 min before the reminder booking)
  await booking({ ...rel(-105, 15), total: 1100, status: 'arrived', advance: 400, items: 2 });
  // the reminder trigger: confirmed, starts ~25 minutes from run time
  await booking({ ...rel(25, 145), total: 1000, advance: 300 });
  // next 7 days: confirmed with/without advances
  await booking({ days: 1, hour: 19, total: 1200, advance: 400 });
  await booking({ days: 1, hour: 21, total: 900 });
  await booking({ days: 2, hour: 18, total: 1000, advance: 300 });
  await booking({ days: 3, hour: 20, total: 1600, advance: 600 });
  await booking({ days: 4, hour: 19, total: 1200 });
  await booking({ days: 5, hour: 7, total: 800, advance: 200 });
  await booking({ days: 6, hour: 20, total: 1400, advance: 500 });

  console.log(`Seeded ${count} demo bookings (statuses: completed/arrived/confirmed/cancelled/no_show).`);
  console.log('Reminder trigger: a confirmed booking starts ~25 minutes from now.');
  console.log('Wipe everything later with: npm run seed:demo -- --wipe');
}

await main();
```

- [ ] **Step 2: Add the npm script** to root `package.json` scripts: `"seed:demo": "tsx db/seed-demo.ts"`.

- [ ] **Step 3: Dry-run against the DEV database**

Run (repo root — `.env`'s `DATABASE_URL` IS the dev branch): `npm run seed:demo`
Expected: `Cleared all bookings…` then `Seeded 29 demo bookings…`. NOTE this wipes the dev DB's bookings — expected. Then verify shape:

```bash
node -e "
const { neon } = require('@neondatabase/serverless'); require('dotenv/config');
const sql = neon(process.env.DATABASE_URL);
sql.query('SELECT status, count(*)::int c FROM bookings GROUP BY status ORDER BY status').then(r => console.log(r));
"
```

Expected: rows for arrived(1), cancelled(2), completed(17), confirmed(8), no_show(1).

- [ ] **Step 4: Verify wipe mode**

Run: `npm run seed:demo -- --wipe` then the count query again → zero bookings. Re-run `npm run seed:demo` to leave dev populated for the visual pass.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (root tsconfig includes `db/**`).

```bash
git add db/seed-demo.ts package.json
git commit -m "feat: wipeable demo-data seeder covering every booking scenario"
```

---

### Task 9: Full verification — suites, build, live visual pass

**Files:** none created — verification and fixes only (any fix found goes in its own commit).

- [ ] **Step 1: Full test + build**

Run: `npm run test:api && npm run typecheck && cd frontend && npm test -- --watch=false && npx ng build`
Expected: backend 68, frontend 70, both clean.

- [ ] **Step 2: Live visual pass against seeded dev data**

Start `npm run dev:api` and `npm --prefix frontend run start -- --port 4201` (4200 may be occupied). Using the seeded dev credentials (owner 9100000001 / owner-dev-pass, worker 9100000002 / worker-dev-pass — re-run `npm run seed:users` with the Task-12 dev values if login fails because a test run wiped users, then `npm run seed:demo` again):

With Playwright (installed): screenshot each screen at 1280×800 AND 390×844 — `/login`, owner bookings, a booking detail, reports, settings, worker dashboard — into `.superpowers/restyle-shots/`. Check each: dawn gradient present, Bricolage headings, day groups with sticky headers, labeled pills (no color-only status), gold only in approved spots, reminder banner visible on worker dashboard (the 25-min booking), count-up on reports, no layout overflow at 390px.

- [ ] **Step 3: Fix anything the visual pass catches** (one commit per fix), re-shoot, then stop both servers.

- [ ] **Step 4: Final commit if any fixes were made**; report the screenshot directory to the controller.

---

## Done

All spec sections implemented: §2-§4 (Task 1, 3), §5 (Tasks 2, 4, 7), §6 (Tasks 1, 2, 6), §7 (Tasks 3-7), §9 (Task 8), §10 (Task 9). Production seeding of demo data is a controller/user step after the visual pass (same command, `DATABASE_URL` pointed at main).
