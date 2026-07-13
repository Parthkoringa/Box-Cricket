import { Router } from 'express';
import { db } from '../db';
import { notFound } from '../errors';
import { requireRole } from '../middleware/auth';

export const paymentsRouter = Router();

paymentsRouter.delete('/:id', requireRole('owner'), async (req, res) => {
  const rows = await db().query('DELETE FROM payments WHERE id = $1 RETURNING id', [req.params.id]) as Record<string, any>[];
  if (!rows[0]) throw notFound('Payment not found');
  res.json({ deleted: rows[0].id });
});
