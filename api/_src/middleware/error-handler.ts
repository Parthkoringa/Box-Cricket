import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

const OVERLAP_MESSAGE = 'This time slot overlaps an existing booking on this court.';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    res.status(400).json({ error: { code: 'VALIDATION', message } });
    return;
  }
  switch (err?.code) {
    case '23P01': // exclusion constraint (double booking)
      res.status(409).json({ error: { code: 'SLOT_OVERLAP', message: OVERLAP_MESSAGE } });
      return;
    case '23505': // unique violation (e.g. duplicate phone)
      res.status(409).json({ error: { code: 'CONFLICT', message: 'That value is already in use.' } });
      return;
    case '23514': // check constraint (end_time > start_time)
      res.status(400).json({ error: { code: 'VALIDATION', message: 'end_time must be after start_time' } });
      return;
    case '22P02': // invalid uuid/enum text in a parameter
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
      return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
