import { Router } from 'express';
import { db } from '../db.js';
import { notFound } from '../errors.js';
import { requireRole } from '../middleware/auth.js';

export const itemsRouter = Router();

itemsRouter.delete('/:id', requireRole('owner'), async (req, res) => {
  const rows = await db().query('DELETE FROM booking_items WHERE id = $1 RETURNING id', [req.params.id]) as Record<string, any>[];
  if (!rows[0]) throw notFound('Item not found');
  res.json({ deleted: rows[0].id });
});
