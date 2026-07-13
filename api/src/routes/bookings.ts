import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { forbidden, notFound } from '../errors';
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
  ) as Record<string, any>[];
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
  res.json(await db().query(sql, params) as Record<string, any>[]);
});

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
  ) as Record<string, any>[];
  const row = rows[0];
  if (!row) throw notFound('Booking not found');
  if (req.user!.role === 'worker' && !row.worker_visible) {
    throw forbidden('This booking is outside your visibility window');
  }
  const payments = await db().query(
    'SELECT id, booking_id, amount, type, method, collected_by, paid_at FROM payments WHERE booking_id = $1 ORDER BY paid_at',
    [req.params.id],
  ) as Record<string, any>[];
  const items = await db().query(
    'SELECT id, booking_id, item_name, quantity, unit_price, total_price, added_by, added_at FROM booking_items WHERE booking_id = $1 ORDER BY added_at',
    [req.params.id],
  ) as Record<string, any>[];
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
  ) as Record<string, any>[];
  if (!rows[0]) throw notFound('Booking not found');
  res.json(rows[0]);
});
