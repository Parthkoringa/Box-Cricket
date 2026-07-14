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
  const rows = await db().query(`SELECT ${SAFE_COLS} FROM users WHERE role = 'worker' LIMIT 1`) as unknown as Array<{ id: string; name: string; phone: string; email: string | null; role: string; is_active: boolean }>;
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
    const rows = await db().query('SELECT role FROM users WHERE id = $1', [req.params.id]) as unknown as Array<{ role: string }>;
    if (!rows[0]) throw notFound('User not found');
    if (rows[0].role !== 'worker') throw forbidden('Only the worker account can be managed');
  }

  if (isSelf && patch.is_active === false) {
    throw forbidden('You cannot deactivate your own account');
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
  ) as unknown as Array<{ id: string; name: string; phone: string; email: string | null; role: string; is_active: boolean }>;
  if (!rows[0]) throw notFound('User not found');
  res.json(rows[0]);
});
