# V1 Launch Checklist — Remaining Steps

Everything below is what's left after the code was completed and merged to
`main` (2026-07-14). Work through it top to bottom; each step tells you
exactly what to do and how to verify it worked.

---

## 1. Push the code to GitHub

- [ ] From the repo root:

```bash
git push origin main
```

**Verify:** the GitHub repo shows the latest commit
`docs: v1 hardening backlog and pending-report spec alignment` and the
`README.md` renders on the repo homepage.

---

## 2. Deploy to Vercel

- [ ] Go to [vercel.com/new](https://vercel.com/new) and **Import** the GitHub repo.
- [ ] Framework preset: leave as **Other** — the committed `vercel.json`
      drives the whole build (frontend static output + one serverless
      function at `/api`). Don't override build settings.
- [ ] Before clicking Deploy, add **Environment Variables**
      (Settings → Environment Variables, or in the import screen):

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | your Neon **main** branch **pooled** connection string (host contains `-pooler`) | this is the `DATABASE_URL_MAIN` value from your local `.env` |
| `JWT_SECRET` | a fresh secret: `openssl rand -base64 32` | do NOT reuse the local dev one |

- [ ] Click **Deploy** and wait for the build.

**Verify:** open `https://<your-app>.vercel.app/api/health` → you should see
`{"ok":true}`. Then open the site root → the login screen should load.

> The database schema is already applied to your Neon `main` branch (done
> during setup on 2026-07-13, verified: `Court 1` seeded) — no schema step
> needed here.

---

## 3. Create the production Owner and Worker accounts

There is no signup page — accounts are created by the seed script, run once
from your machine against the production database:

- [ ] From the repo root (fill in real names/phones and strong passwords):

```bash
DATABASE_URL="<your Neon MAIN pooled connection string>" \
OWNER_NAME="..." OWNER_PHONE="..." OWNER_PASSWORD="..." \
WORKER_NAME="..." WORKER_PHONE="..." WORKER_PASSWORD="..." \
npm run seed:users
```

Re-running it later is safe — it updates the same two accounts (matched by
phone number).

**Verify:** log in on the deployed site with the owner phone + password →
you land on the bookings screen. Log out, log in as the worker → you land
on the worker dashboard.

---

## 4. Rotate the exposed database password (do this soon)

The Neon password was pasted into the chat session on 2026-07-13, so treat
it as exposed.

- [ ] Neon console → your project → **Roles** (or the branch's connection
      panel) → reset the password for `neondb_owner`.
- [ ] Update the new connection strings in:
  - your local `.env` and `.env.local`
  - the `DATABASE_URL` env var in Vercel (Settings → Environment Variables),
    then **Redeploy** so the function picks it up.

**Verify:** `/api/health` still returns `{"ok":true}` after the redeploy and
login still works.

---

## 5. Split the shared dev/test Neon branch (recommended)

Your `dev` and `test` connection strings currently point at the **same**
branch, so every test run (`npm run test:api`) wipes local dev data.

- [ ] Neon console → Branches → create a new branch from `main`
      (name it `dev`).
- [ ] Copy its **pooled** connection string into `.env` as `DATABASE_URL`
      (leave `DATABASE_URL_TEST` pointing at the old branch).

**Verify:** run `npm run test:api`, then check the dev branch's data is
untouched.

---

## 6. User acceptance testing (with the real owner & worker)

Run through this on the deployed site — owner on a desktop, worker on their
actual phone:

- [ ] Owner: create a booking → edit its time → cancel it (reason prompt
      appears; advance shows as forfeited).
- [ ] Owner: try to create two overlapping bookings → the second is rejected
      with "This time slot overlaps an existing booking on this court."
- [ ] Owner: reports page shows today's revenue, pending payments, and the
      trends chart — check it on a phone too.
- [ ] Worker: sees today's and upcoming bookings; bookings older than 7 days
      are view-only; cannot edit/cancel anything.
- [ ] Worker: full game flow on the phone — mark arrival → record a cash
      payment and a UPI payment → add an extra item (e.g. water bottle) →
      mark completed. Balance updates correctly at each step.
- [ ] Worker: create a booking (as owner) starting ~20 minutes from now →
      the reminder banner appears on the worker dashboard within a minute →
      dismiss it → it stays gone after a page reload.
- [ ] Owner: Settings → deactivate the worker → worker cannot log in →
      reactivate → login works again.
- [ ] Both: log out and back in on both devices.

Note anything that feels wrong during UAT — small UX fixes are cheap now.

---

## 7. One open product decision (from the build)

**Should "dismiss reminder" only work while the reminder is actually
showing?** Right now the API technically lets the worker acknowledge any
booking early, which would silence that booking's future reminder. Only the
worker can do this and it only affects their own reminders, so it shipped
as-is. If you want it tightened, it's a one-line change — item 3 in
`docs/planning/v1-hardening-backlog.md`.

---

## 8. Handover to the ground owner (when the time comes)

- [ ] Vercel → project → Settings → **Transfer Project** to the owner's
      Vercel account (the Neon integration moves with it).
- [ ] GitHub → repo → Settings → **Transfer ownership** to their GitHub
      account.
- [ ] Rotate `JWT_SECRET` in Vercel one final time (invalidates all logged-in
      sessions — takes effect on redeploy).
- [ ] Reset the Neon password again and update Vercel's `DATABASE_URL`.
- [ ] Re-run the seed script (step 3) with credentials the owner chooses
      themselves, so you never know their final passwords.

---

## Later: hardening backlog

Nine reviewed-and-deferred improvements (performance, edge-case error
messages, login hardening, offline fonts) live in
`docs/planning/v1-hardening-backlog.md`, in priority order. None are needed
for launch.
