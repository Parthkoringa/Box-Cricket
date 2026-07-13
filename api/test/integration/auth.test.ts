import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { config } from '../../src/config';
import { db } from '../../src/db';
import { errorHandler } from '../../src/middleware/error-handler';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { resetDb, seedUser } from '../helpers';

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('owner');
    await seedUser('worker');
  });

  it('returns a 12h token and the user for valid phone credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000001', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Test owner', role: 'owner' });
    const payload = jwt.verify(res.body.token, config.jwtSecret) as { role: string; exp: number; iat: number };
    expect(payload.role).toBe('owner');
    expect(payload.exp - payload.iat).toBe(12 * 3600);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000001', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an unknown identifier with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'nobody@x.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('rejects an inactive user with 401', async () => {
    await db().query(`UPDATE users SET is_active = FALSE WHERE phone = '9000000002'`);
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000002', password: 'password123' });
    expect(res.status).toBe(401);
    await db().query(`UPDATE users SET is_active = TRUE WHERE phone = '9000000002'`);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '9000000001' });
    expect(res.status).toBe(400);
  });
});

describe('requireAuth / requireRole', () => {
  const mini = express();
  mini.get('/owner-only', requireAuth, requireRole('owner'), (_req, res) => { res.json({ ok: true }); });
  mini.use(errorHandler);
  const tokenFor = (role: 'owner' | 'worker') =>
    jwt.sign({ sub: '00000000-0000-0000-0000-000000000000', role, name: 't' }, config.jwtSecret);

  it('401 without a token', async () => {
    expect((await request(mini).get('/owner-only')).status).toBe(401);
  });

  it('401 with a garbage token', async () => {
    expect((await request(mini).get('/owner-only').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('403 with a worker token', async () => {
    expect((await request(mini).get('/owner-only').set('Authorization', `Bearer ${tokenFor('worker')}`)).status).toBe(403);
  });

  it('200 with an owner token', async () => {
    expect((await request(mini).get('/owner-only').set('Authorization', `Bearer ${tokenFor('owner')}`)).status).toBe(200);
  });
});
