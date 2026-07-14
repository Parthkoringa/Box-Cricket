# V1 Hardening Backlog

Deferred findings from the V1 implementation reviews (2026-07-14), in priority
order. None block the V1 deployment; all were explicitly triaged "fix later"
in the final whole-branch review. File references use the current layout
(`api/_src/...`).

1. **Route-scope the chart registration.** `provideCharts(withDefaultRegisterables())`
   sits in the root `app.config.ts`, pulling ~240 kB of Chart.js into the
   initial bundle for every route. Move it to `providers: [...]` on the lazy
   `/owner/reports` route.
2. **Map remaining Postgres error codes to 400.** `api/_src/middleware/error-handler.ts`:
   add `22007`/`22008` (calendar-invalid dates that pass the shape regex, e.g.
   `2026-13-45`) and `22003` (NUMERIC overflow on huge amounts) → 400
   VALIDATION instead of the generic 500.
3. **Reminder-ack guard (pending owner decision).** `POST /api/reminders/:id/ack`
   currently acknowledges any booking id. Adding
   `AND status = 'confirmed' AND NOT reminder_acknowledged` to the UPDATE
   prevents a worker from pre-silencing future reminders. One WHERE clause in
   `api/_src/routes/reminders.ts`; behavior question raised with the owner,
   unanswered as of V1 ship.
4. **Transition race guard.** `applyTransition` reads status, then updates
   without re-checking (`api/_src/routes/bookings.ts`). Harden with
   `UPDATE ... WHERE id = $1 AND status = $expected` + row-count check.
   Unreachable in practice at two-user scale.
5. **Escape ILIKE wildcards in booking search.** `%`/`_` in the `?q=` filter act
   as wildcards instead of literals (parameterized — no injection risk).
6. **Login hardening batch.** Case-insensitive email match
   (`LOWER(email) = LOWER($1)`), timing-safe compare (bcrypt against a dummy
   hash when the user is unknown/inactive), and pin `algorithms: ['HS256']`
   in `jwt.verify`.
7. **Self-host Material fonts/icons.** `frontend/src/index.html` loads Google
   Fonts from CDN; the ground's connectivity may be spotty — vendor the fonts
   into the build.
8. **`requireAuth` does not re-check `is_active`.** A deactivated worker's JWT
   stays valid up to 12 h. Standard trade-off; re-check on each request or
   shorten the TTL if it ever matters.
9. **Misc polish.** `inr` pipe shows `₹1,040.5` for single-decimal values (set
   `minimumFractionDigits` when cents matter); bookings-list and reports
   `load()` subscribe without error snackbars (a failed load looks like "no
   data"); `db/seed-users.ts` upsert doesn't update `role` on phone conflict.

## Spec-wording note

`GET /api/reports/pending` excludes both `cancelled` **and** `no_show`
bookings. The spec originally said "non-cancelled"; the implemented behavior
is deliberate (a no-show's balance is uncollectable and its advance already
forfeited) and the spec has been updated to match.
