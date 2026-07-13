import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;
const WIDE = 'from=2000-01-01&to=2100-01-01';

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
  await db().query('TRUNCATE bookings CASCADE');

  // Booking A: total 1000, paid 400 advance → pending 600
  const a = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court));
  await request(app).post(`/api/bookings/${a.body.id}/payments`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ amount: 400, type: 'advance', method: 'cash' });

  // Booking B: tomorrow, paid 300 advance, then cancelled → forfeited 300
  const t = new Date(Date.now() + 26 * 3_600_000);
  const b = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court, {
      booking_date: t.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: t.toISOString(),
      end_time: new Date(t.getTime() + 2 * 3_600_000).toISOString(),
    }));
  await request(app).post(`/api/bookings/${b.body.id}/payments`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ amount: 300, type: 'advance', method: 'upi' });
  await request(app).post(`/api/bookings/${b.body.id}/cancel`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ reason: 'rain' });
});

describe('reports', () => {
  it('summary aggregates revenue, forfeits, and status counts', async () => {
    const res = await request(app).get(`/api/reports/summary?${WIDE}`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.revenue)).toBe(700);              // 400 + 300 collected
    expect(Number(res.body.forfeited_advances)).toBe(300);   // B's advance
    expect(res.body.bookings.confirmed).toBe(1);
    expect(res.body.bookings.cancelled).toBe(1);
  });

  it('pending lists only live bookings with balance due', async () => {
    const res = await request(app).get('/api/reports/pending').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1); // A only — B is cancelled despite balance
    expect(Number(res.body[0].balance_due)).toBe(600);
  });

  it('trends returns one row per day with bookings and revenue', async () => {
    const res = await request(app).get(`/api/reports/trends?${WIDE}`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    const total = res.body.reduce((s: number, r: { bookings: number }) => s + r.bookings, 0);
    expect(total).toBe(2);
    const revenue = res.body.reduce((s: number, r: { revenue: string }) => s + Number(r.revenue), 0);
    expect(revenue).toBe(700);
    expect(res.body[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is owner-only and validates the range', async () => {
    expect((await request(app).get(`/api/reports/summary?${WIDE}`)
      .set('Authorization', `Bearer ${worker.token}`)).status).toBe(403);
    expect((await request(app).get('/api/reports/summary?from=2026-02-01&to=2026-01-01')
      .set('Authorization', `Bearer ${owner.token}`)).status).toBe(400);
  });
});
