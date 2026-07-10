# Version 1 – Basic Management System
### Project Plan (Planning Phase — Pre-Development)

---

## 1. Feasibility Assessment

**Verdict: Highly feasible. Low-to-medium complexity.**

This is a standard role-based CRUD application (Owner/Admin + single Worker), with no public-facing booking, no payment gateway integration, and no complex concurrency concerns. It closely resembles internal operations/CRM tools that are built routinely. There is no technical blocker to building this.

**Estimated MVP timeline:** 3–5 weeks for a solo developer, assuming requirements below are confirmed early. This is a rough planning estimate, not a quote — refine once open questions are answered.

---

## 2. Objective

Digitize the *existing* manual workflow exactly as it runs today — replace the notebook with software — without changing how the business actually operates. The owner still takes bookings by phone; the software replaces pen-and-paper record keeping, communication to the worker, and payment tracking.

---

## 3. User Roles & Permissions

| Capability | Owner (Admin) | Worker |
|---|---|---|
| Create booking | ✅ (yes) | ❌ |
| Edit booking details | ✅ (yes) | ❌ |
| Cancel booking | ✅ (yes) | ❌ |
| View all bookings | ✅ (yes) | ✅ (yes) (assigned/upcoming only) |
| Mark customer arrival | ✅ (yes) | ✅ (yes) |
| Record remaining payment | ✅ (yes) | ✅ (yes) |
| Add extra charges (snacks, water, etc.) | ✅ (yes) | ✅ (yes) |
| Mark booking completed | ✅ (yes) | ✅ (yes) |
| View reports/analytics | ✅ (yes) | ❌ |
| Manage worker account | ✅ (yes) | ❌ |

Only two account types exist in this version — no customer accounts, no public sign-up.

---

## 4. Core Modules

1. **Authentication** — simple login for Owner and Worker (no public registration)
2. **Booking Management** — create/edit/cancel bookings, view booking calendar/list
3. **Payment Tracking** — advance collected, remaining due, extra item charges, payment status
4. **Worker Dashboard** — today's bookings, arrival check-in, payment collection, completion marking, upcoming-booking reminder alerts (e.g., "starts in 30 min")
5. **Owner Dashboard & Reports** — daily/monthly earnings, pending payments, booking history, basic analytics (peak hours, revenue trend)
6. **Worker Account Management** — owner can manage the single worker's credentials/access

---

## 5. Digitized Workflow

1. Customer calls owner → owner checks slot availability **in the system** (not memory/notebook)
2. Owner creates booking directly in software: customer name, phone, date, time slot, advance amount, remaining amount
3. Booking instantly visible to the worker — **no manual phone relay needed**
4. Customer arrives → worker looks up booking by name/phone in the app (not a notebook)
5. Worker marks arrival, collects remaining payment + any extra items, marks booking completed
6. Owner reviews dashboard anytime for real-time visibility — no need to physically check a notebook

---

## 6. Confirmed Tech Stack

- **Frontend:** Angular (SPA) — no SSR/SEO needed for an internal tool with no public pages; works fine on desktop (owner) and mobile browser (worker); deployed to Vercel as a static build
- **Backend:** Node.js + Express (TypeScript) — deployed to Vercel as a serverless function (Vercel supports zero-config Express deployment); keeps one language across frontend and backend
- **Database:** PostgreSQL via **Neon** — serverless Postgres, provisioned through Vercel's native Neon marketplace integration; relational structure fits bookings/payments/reporting well
- **Hosting:** Vercel (frontend + backend) + Neon (database) — **Vercel Hobby (free)**, confirmed as personal, non-commercial use
- **Auth:** Simple JWT-based login, no public registration flow — only Owner and Worker accounts

**Serverless note:** the backend runs as a function per request, not an always-on process — no in-memory state or background workers. The database connection uses Neon's **pooled connection string** (not a persistent app-level pool) so concurrent function invocations don't exhaust Postgres connections. Neither constraint affects V1 — there are no background jobs, and the "starts in 30 min" reminder is computed via a query, not a scheduled process.

This covers V1 cleanly. If V2 later needs persistent slot holds during checkout, WebSockets, or background workers (flagged as technical risks in the V2 plan), that piece may need a different runtime than Vercel's serverless functions — worth revisiting at that stage rather than assuming now.

---

## 7. Development Phases

| Phase | Deliverable |
|---|---|
| 0 | Finalize requirements (see Open Questions) |
| 1 | Database schema + authentication (Owner/Worker login) |
| 2 | Booking CRUD for Owner |
| 3 | Worker dashboard (view, arrival, payment, extras, completion) |
| 4 | Owner reports & analytics dashboard |
| 5 | Testing with real ground data / UAT with actual owner & worker |
| 6 | Deployment + short training/handoff session |

---

## 8. Edge Cases to Handle

- Two bookings accidentally created for an overlapping time slot
- Booking edited by owner *after* worker has already been informed — needs clear "last updated" visibility
- Customer no-show — resolved: advance is forfeited automatically
- Worker marks the wrong customer as arrived (duplicate names)
- Booking cancelled after advance collected — refund vs forfeiture needs a defined rule
- Worker's device offline at the exact moment of check-in

---

## 9. Confirmed Requirements

- V1 launches with **a single bookable court**, but the schema is court-aware (not just venue-aware) — adding parallel courts later is just adding rows, no migration
- V1 defaults every booking to a **2-hour slot**, but the schema stores exact start/end times, so custom durations (1 hr, 1.5 hr, etc.) are a UI change later, not a schema change
- Single worker only
- No in-app payment collection or gateway in V1 — customer pays via cash or the site's existing UPI QR code, and the **worker manually logs which method was used** after receiving it
- No customer-facing interface — customers never log into anything
- No-show or cancellation → advance payment is **forfeited** (owner keeps it); there's no formal cancellation window/refund policy in V1 — proper availability/cancellation handling is a V2 concern
- In-app reminder/alert for upcoming bookings is in scope for V1 — **worker-facing only**, not the owner

---

## 10. Open Questions

None outstanding — all V1 requirements are confirmed. See `version-1-database-schema.md` and `version-1-database-schema.sql` for the resulting schema design.

---

## 11. Recommendation

Build this version first. It solves the client's most acute pain (miscommunication + lost records) with the least technical risk, and gives you real usage data and a validated database schema before investing in Version 2's payment and public-booking complexity.

---

## 12. Deployment & Handover Approach

- **Platform:** Vercel (frontend + backend) with Neon Postgres via Vercel's native database integration — provisioned from the same Vercel dashboard, no separate database console to juggle day-to-day.
- **Plan:** Vercel Hobby (free) — confirmed as personal, non-commercial use.
- **Handover mechanism:** Vercel's **Transfer Project** (or **Claim Deployments** for a fully separate account) moves the project — and its connected Neon database — directly into the other person's account with no downtime.
- **At handover, also:** transfer the GitHub repository to their own account, and rotate the JWT signing secret and any database credentials seen during development.
