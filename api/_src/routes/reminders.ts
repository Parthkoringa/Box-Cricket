import { Router } from 'express';
import { db } from '../db.js';
import { notFound } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { BOOKING_COLS } from './bookings.js';

export const remindersRouter = Router();

remindersRouter.get('/', requireRole('worker'), async (_req, res) => {
  const rows = await db().query(
    `SELECT ${BOOKING_COLS} FROM bookings
     WHERE status = 'confirmed'
       AND start_time BETWEEN now() AND now() + interval '30 minutes'
       AND NOT reminder_acknowledged
     ORDER BY start_time`,
  ) as Record<string, any>[];
  res.json(rows);
});

remindersRouter.post('/:bookingId/ack', requireRole('worker'), async (req, res) => {
  const rows = await db().query(
    'UPDATE bookings SET reminder_acknowledged = TRUE WHERE id = $1 RETURNING id',
    [req.params.bookingId],
  ) as Record<string, any>[];
  if (!rows[0]) throw notFound('Booking not found');
  res.json({ ok: true });
});
