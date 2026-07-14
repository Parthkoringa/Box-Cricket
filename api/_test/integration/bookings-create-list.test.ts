import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../_src/app';
import { db } from '../../_src/db';
import { bookingPayload, courtId, insertBookingAt, resetDb, seedUser, type TestUser } from '../helpers';

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

describe('GET /api/courts', () => {
  it('lists the seeded court for any authenticated user', async () => {
    const res = await request(app).get('/api/courts').set('Authorization', `Bearer ${worker.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Court 1');
  });

  it('401 without a token', async () => {
    expect((await request(app).get('/api/courts')).status).toBe(401);
  });
});

describe('POST /api/bookings', () => {
  it('owner creates a booking (201, status confirmed)', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(bookingPayload(court));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.customer_name).toBe('Test Customer');
    expect(res.body.booking_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('worker cannot create (403)', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${worker.token}`)
      .send(bookingPayload(court));
    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(bookingPayload(court, { customer_name: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects end_time <= start_time with 400', async () => {
    const p = bookingPayload(court);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...p, end_time: p.start_time });
    expect(res.status).toBe(400);
  });

  it('returns the clean 409 on an overlapping slot', async () => {
    const p = bookingPayload(court);
    await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(p);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...p, customer_name: 'Second Group' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This time slot overlaps an existing booking on this court.');
  });

  it('allows rebooking a cancelled slot', async () => {
    const p = bookingPayload(court);
    const first = await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(p);
    await db().query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [first.body.id]);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...p, customer_name: 'Replacement Group' });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/bookings', () => {
  it('filters by status and by name/phone search, and includes balance columns', async () => {
    const a = bookingPayload(court, { customer_name: 'Ravi Patel', customer_phone: '9111111111' });
    const later = new Date(Date.now() + 30 * 3_600_000);
    const b = bookingPayload(court, {
      customer_name: 'Suresh Shah',
      customer_phone: '9222222222',
      booking_date: later.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: later.toISOString(),
      end_time: new Date(later.getTime() + 2 * 3_600_000).toISOString(),
    });
    await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(a);
    await request(app).post('/api/bookings').set('Authorization', `Bearer ${owner.token}`).send(b);

    const byName = await request(app).get('/api/bookings?q=ravi').set('Authorization', `Bearer ${owner.token}`);
    expect(byName.body).toHaveLength(1);
    expect(byName.body[0].customer_name).toBe('Ravi Patel');
    expect(byName.body[0].balance_due).toBeDefined();

    const byPhone = await request(app).get('/api/bookings?q=9222').set('Authorization', `Bearer ${owner.token}`);
    expect(byPhone.body).toHaveLength(1);

    const confirmed = await request(app).get('/api/bookings?status=confirmed').set('Authorization', `Bearer ${owner.token}`);
    expect(confirmed.body).toHaveLength(2);
  });

  it('clamps worker results to the last 7 days, owner sees everything', async () => {
    await insertBookingAt(court, -10, owner.id); // 10 days ago — outside worker window
    await insertBookingAt(court, -2, owner.id);  // 2 days ago — inside window
    const workerList = await request(app).get('/api/bookings').set('Authorization', `Bearer ${worker.token}`);
    expect(workerList.body).toHaveLength(1);
    const ownerList = await request(app).get('/api/bookings?from=2000-01-01').set('Authorization', `Bearer ${owner.token}`);
    expect(ownerList.body).toHaveLength(2);
  });
});
