# Morning Maidan Restyle + Demo Data — Design

**Date:** 2026-07-14
**Status:** Approved (visual direction and v2 preview approved by user via visual companion; previews archived in `.superpowers/brainstorm/`)
**Scope:** Visual restyle of the entire Angular app + a demo-data seeder. No backend API or business-logic changes.

## 1. Goal

Replace the stock azure-Material look with a distinctive, client-impressing
"Morning Maidan" aesthetic — near-white dawn palette led by deep teal, gold
used only as a garnish — and redesign list screens to stay beautiful under
heavy booking volume. Seed the production database with realistic demo data
(easily wiped) so every screen can be reviewed on the deployed site.

## 2. Design tokens (single source of truth in `styles.scss`)

```css
--bc-ink:        #1a2b31;   /* text */
--bc-muted:      #647b82;   /* secondary text */
--bc-paper:      #fbfaf7;   /* app background base (near-white) */
--bc-sand:       #f3ecdd;   /* gradient edge / rails */
--bc-line:       #e8e3d6;   /* hairlines */
--bc-card:       #ffffff;   /* surfaces */
--bc-teal:       #0f4c5c;   /* primary — brand, headings, numbers, buttons */
--bc-teal-deep:  #0a3844;   /* hover/pressed */
--bc-teal-soft:  rgba(15,76,92,.08);
--bc-gold:       #e0a52e;   /* garnish ONLY: wordmark accent, active-nav underline, arrived, pending tile, reminder banner */
--bc-green:      #2e7d4f;   /* completed / paid */
--bc-red:        #c4502c;   /* cancelled / destructive */
--bc-grey:       #8a9296;   /* no-show */
--bc-shadow:     0 6px 18px rgba(15,76,92,.08);
--bc-shadow-lift:0 10px 26px rgba(15,76,92,.14);
--bc-radius:     14px;
```

Status map: confirmed → teal, arrived → gold, completed → green,
cancelled → red, no_show → grey. Each status gets a tinted pill
(10% background, 30% border, full-strength text) and a matching dot.

Material integration: override `--mat-sys-primary`, `--mat-sys-surface`,
`--mat-sys-on-surface`, `--mat-sys-error`, and the other system tokens the
components consume, so Material buttons/forms/dialogs/snackbars inherit the
palette without per-component fighting. `mat.theme` keeps a prebuilt palette
closest to teal as the base; our overrides win.

## 3. Typography

- **Bricolage Grotesque** (400/600/800, optical sizing): wordmark, headings,
  section titles, day headers, and ALL hero numbers (balances, stats, time
  rails).
- **Albert Sans** (400/500/700): body, forms, labels, table text.
- Replace the Roboto Google-Fonts link in `index.html`; keep Material Icons.
- Wordmark: `Box` in teal + `Cricket` in gold, Bricolage 800.

## 4. Atmosphere & chrome

- Body background on every screen: `linear-gradient(165deg, #fdfcfa, #f6f1e4)`
  plus a faint radial gold glow (10% opacity) in the top-right corner. No
  flat white pages.
- Toolbars become a translucent paper header: `rgba(253,252,250,.8)` +
  `backdrop-filter: blur(6px)`, hairline bottom border, wordmark left, nav
  center/right. Active nav link: teal text + 2px gold underline that animates
  in (width transition).
- Login is a hero screen: glowing gold sun disc (pure CSS radial + soft
  box-shadow pulse), large wordmark, tagline, white card that fades-up on
  load. Faint white court-line arcs in the background (CSS borders, ≤5%
  opacity).

## 5. Density: day-grouped rows (the big structural change)

`BookingsListComponent` (owner) and the worker dashboard's *Upcoming* and
*Last 7 days* sections switch from one-card-per-booking to **day groups**:

- A computed groups the loaded bookings by `booking_date` (already sorted by
  `start_time` server-side) into `{ date, label, bookings, count, totalDue }`.
- **Sticky day header** per group: "Today / Tomorrow / Fri 18 Jul" (Bricolage)
  + `n bookings · ₹X due` summary (sum of `balance_due` — display only,
  computed from the strings via Number()).
- **Rows** inside a white rounded container: time rail (start/end stacked,
  Bricolage teal, sand right-border) · name + phone (ellipsized) · status dot
  · due amount (or PAID / CANCELLED / NO-SHOW word in status color). Row
  height ~52px; hover tints teal-soft; whole row navigates to detail.
- The worker's **Today** section keeps larger tappable cards (few items,
  action-focused) restyled to the new tokens.
- Label logic (`Today`/`Tomorrow`/weekday+date) lives in a small exported
  helper `dayLabel(date: string, today: string): string` in
  `core/booking-time.ts` with unit tests.

## 6. Motion inventory (CSS-only unless noted)

- **Page entrance:** one orchestrated stagger per screen — sections fade-up
  60ms apart; list rows stagger 30ms/row capped at 10 (`:nth-child` delays).
- **Count-up numbers** on report stat tiles: tiny standalone `CountUpDirective`
  (rAF-based, ~30 lines, no deps) animating 0→value over 800ms; falls back to
  instant when `prefers-reduced-motion`.
- **Skeleton shimmer** while lists/reports load: gradient-sweep placeholder
  rows (component shows skeletons until first data arrives).
- **Reminder banner:** gold gradient band, bell icon rings (keyframed rotate)
  every few seconds, slide-down entrance, fade-out on dismiss.
- **Micro:** card/row hover lift, button press scale(.98), dialog fade-scale,
  snackbar slides. All wrapped in `@media (prefers-reduced-motion: no-preference)`.
- Trends chart: teal line with gradient fill (Chart.js `fill` + gradient),
  gold dashed revenue-companion line, animated draw on load.

## 7. Screens checklist (all get tokens + atmosphere + entrance)

login · owner bookings (day groups) · booking detail (hero header: name +
big balance triptych, sectioned payments/items with styled rows) · reports
(2×2 stat tiles with corner-circle motif, chart card, pending table with
sticky header + row hover) · settings (two cards) · worker dashboard (banner,
Today cards, dense Upcoming/Past groups) · dialogs (booking form, payment,
item, cancel) · empty states (sand circle + Material icon + friendly line)
· 404/redirect states untouched.

## 8. Constraints & safety

- No API/service/model changes; component logic changes limited to the
  grouping computed, skeleton flags, and the count-up directive.
- Keep every `data-test` attribute and all user-visible strings the tests
  assert (`Mark arrived`, `₹…` formats, section names Today/Upcoming/etc.).
- All 66 frontend tests stay green; add unit tests for `dayLabel` and the
  grouping computed. `ng build` must succeed (budget warning ok).
- Mobile-first: rows collapse gracefully ≤600px (phone rail narrows, phone
  number hides), dialogs full-width, header condenses.

## 9. Demo data seeder

New `db/seed-demo.ts` + npm scripts `seed:demo` (and `seed:demo -- --wipe`).

- **Requires** the two real accounts to exist (`seed:users` first) — fails
  loudly otherwise. Uses `DATABASE_URL` env (user points it at prod main).
- **Wipe mode:** `--wipe` runs `TRUNCATE bookings CASCADE` (users/courts
  kept) and exits — one command back to clean.
- **Scenario set (~28 bookings, non-overlapping hourly grid, IST):**
  - Past 14 days: 1–3 completed/day with full payment trails (advance+
    remaining, cash/upi mix) and extra items (water, snacks, tape ball) on
    ~half; 2 completed with balance still due (pending report); 2 cancelled
    (reason + forfeited advance); 1 no-show (forfeited).
  - Today: 1 completed this morning, 1 **arrived** in progress, 1 confirmed
    this evening, and 1 confirmed starting **~25 minutes from run time**
    (unacknowledged → reminder banner fires).
  - Next 7 days: 6–8 confirmed with advances (some with none — full balance).
  - Names/phones: realistic Indian names + team names; amounts ₹800–1,600
    per 1–2h slot so reports show a believable revenue curve.
- Implementation mirrors `seed-users.ts` (Neon driver, parameterized SQL,
  `Date`-based IST math like the API tests).

## 10. Verification

Frontend suite + build; screenshot pass on desktop + 390px mobile for every
screen (owner + worker) via the run/dev server; seed-demo executed against
the dev DB first as a dry run, then production per the user's choice; wipe
verified on dev.
