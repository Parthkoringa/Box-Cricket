import { Router } from 'express';
import { db } from '../db';

export const courtsRouter = Router();

courtsRouter.get('/', async (_req, res) => {
  const rows = await db().query('SELECT id, venue_id, name FROM courts WHERE is_active ORDER BY name');
  res.json(rows);
});
