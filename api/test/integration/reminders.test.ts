import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { bookingPayload, courtId, resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;
let court: string;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
  court = await courtId();
});

beforeEach(async () => {
  await db().query('TRUNCATE bookings CASCADE');
});

async function createStartingInMinutes(minutes: number): Promise<string> {
  const start = new Date(Date.now() + minutes * 60_000);
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court, {
      booking_date: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    }));
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('GET /api/reminders', () => {
  it('shows a confirmed booking starting in 15 minutes, not one 3 hours out', async () => {
    const soonId = await createStartingInMinutes(15);
    await createStartingInMinutes(180);
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(soonId);
  });

  it('is worker-only (owner gets 403)', async () => {
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });

  it('acknowledged reminders disappear; unknown booking ack is 404', async () => {
    const id = await createStartingInMinutes(20);
    let res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(id);
    const ack = await request(app).post(`/api/reminders/${id}/ack`).set('Authorization', `Bearer ${worker.token}`);
    expect(ack.status).toBe(200);
    expect(ack.body).toEqual({ ok: true });
    res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(0);
    expect((await request(app).post('/api/reminders/00000000-0000-0000-0000-000000000001/ack')
      .set('Authorization', `Bearer ${worker.token}`)).status).toBe(404);
  });

  it('includes a booking 29 minutes out', async () => {
    const inWindow = await createStartingInMinutes(29);
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(inWindow);
  });

  it('excludes a booking 31 minutes out', async () => {
    await createStartingInMinutes(31);
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(0);
  });

  it('excludes a booking whose start time has already passed', async () => {
    await createStartingInMinutes(-5);
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(0);
  });

  it('ack is worker-only (owner gets 403)', async () => {
    const id = await createStartingInMinutes(20);
    const res = await request(app).post(`/api/reminders/${id}/ack`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });

  it('an arrived booking no longer reminds', async () => {
    const id = await createStartingInMinutes(15);
    await request(app).post(`/api/bookings/${id}/arrive`).set('Authorization', `Bearer ${worker.token}`);
    const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${worker.token}`);
    expect(res.body).toHaveLength(0);
  });
});
