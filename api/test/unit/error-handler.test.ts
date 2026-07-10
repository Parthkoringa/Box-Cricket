import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { notFound } from '../../src/errors';
import { errorHandler } from '../../src/middleware/error-handler';
import { app } from '../../src/app';

function appWith(route: (req: express.Request, res: express.Response) => void) {
  const t = express();
  t.get('/t', route);
  t.use(errorHandler);
  return t;
}

describe('errorHandler', () => {
  it('maps AppError to its status and shape', async () => {
    const res = await request(appWith(() => { throw notFound('Booking not found'); })).get('/t');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Booking not found' } });
  });

  it('maps ZodError to 400 with field messages', async () => {
    const res = await request(appWith(() => { z.object({ name: z.string() }).parse({}); })).get('/t');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toContain('name');
  });

  it('maps exclusion-constraint violation (23P01) to the clean 409', async () => {
    const t = express();
    t.get('/t', (_req, _res, next) => next(Object.assign(new Error('conflict'), { code: '23P01' })));
    t.use(errorHandler);
    const res = await request(t).get('/t');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This time slot overlaps an existing booking on this court.');
  });

  it('maps check-constraint violation (23514) to 400', async () => {
    const t = express();
    t.get('/t', (_req, _res, next) => next(Object.assign(new Error('check'), { code: '23514' })));
    t.use(errorHandler);
    const res = await request(t).get('/t');
    expect(res.status).toBe(400);
  });

  it('maps unique violation (23505) to 409 and bad uuid (22P02) to 404', async () => {
    const uniq = express();
    uniq.get('/t', (_req, _res, next) => next(Object.assign(new Error('dup'), { code: '23505' })));
    uniq.use(errorHandler);
    expect((await request(uniq).get('/t')).status).toBe(409);

    const uuid = express();
    uuid.get('/t', (_req, _res, next) => next(Object.assign(new Error('uuid'), { code: '22P02' })));
    uuid.use(errorHandler);
    expect((await request(uuid).get('/t')).status).toBe(404);
  });

  it('hides unknown errors behind a generic 500', async () => {
    const res = await request(appWith(() => { throw new Error('secret db detail'); })).get('/t');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

describe('app skeleton', () => {
  it('serves GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
