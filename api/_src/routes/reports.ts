import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { DATE_RE } from '../validation.js';
import { BOOKING_COLS } from './bookings.js';

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
  ) as { revenue: string }[];
  const [forf] = await db().query(
    `SELECT COALESCE(SUM(p.amount), 0)::text AS forfeited
     FROM payments p JOIN bookings b ON b.id = p.booking_id
     WHERE b.advance_forfeited AND p.type = 'advance' AND b.booking_date BETWEEN $1 AND $2`,
    [from, to],
  ) as { forfeited: string }[];
  const counts = await db().query(
    `SELECT status::text AS status, COUNT(*)::int AS count
     FROM bookings WHERE booking_date BETWEEN $1 AND $2 GROUP BY status`,
    [from, to],
  ) as { status: string; count: number }[];
  res.json({
    revenue: rev.revenue,
    forfeited_advances: forf.forfeited,
    bookings: Object.fromEntries(counts.map((c) => [c.status, c.count])),
  });
});

reportsRouter.get('/pending', async (_req, res) => {
  const rows = await db().query(
    `SELECT ${BOOKING_COLS}, v.total_due, v.total_paid, v.balance_due
     FROM bookings JOIN booking_balances v ON v.booking_id = bookings.id
     WHERE status NOT IN ('cancelled', 'no_show') AND v.balance_due > 0
     ORDER BY booking_date, start_time`,
  ) as Record<string, any>[];
  res.json(rows);
});

reportsRouter.get('/trends', async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const byDay = await db().query(
    `SELECT booking_date::text AS day, COUNT(*)::int AS bookings
     FROM bookings WHERE booking_date BETWEEN $1 AND $2 GROUP BY booking_date`,
    [from, to],
  ) as { day: string; bookings: number }[];
  const revByDay = await db().query(
    `SELECT ((paid_at AT TIME ZONE 'Asia/Kolkata')::date)::text AS day, SUM(amount)::text AS revenue
     FROM payments WHERE (paid_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1 AND $2 GROUP BY 1`,
    [from, to],
  ) as { day: string; revenue: string }[];
  const days = new Map<string, { day: string; bookings: number; revenue: string }>();
  for (const r of byDay) {
    days.set(r.day, { day: r.day, bookings: r.bookings, revenue: '0' });
  }
  for (const r of revByDay) {
    const entry = days.get(r.day) ?? { day: r.day, bookings: 0, revenue: '0' };
    entry.revenue = r.revenue;
    days.set(r.day, entry);
  }
  res.json([...days.values()].sort((a, b) => a.day.localeCompare(b.day)));
});
