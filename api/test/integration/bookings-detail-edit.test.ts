import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
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

async function createBooking(overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court, overrides));
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('GET /api/bookings/:id', () => {
  it('returns detail with empty payments/items and balance equal to total', async () => {
    const id = await createBooking();
    const res = await request(app).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.payments).toEqual([]);
    expect(res.body.items).toEqual([]);
    expect(Number(res.body.balance_due)).toBe(1000);
    expect(res.body.worker_visible).toBeUndefined();
  });

  it('404 for an unknown id and for a malformed id', async () => {
    const unknown = await request(app)
      .get('/api/bookings/00000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(unknown.status).toBe(404);
    const malformed = await request(app).get('/api/bookings/not-a-uuid').set('Authorization', `Bearer ${owner.token}`);
    expect(malformed.status).toBe(404);
  });

  it('worker gets 403 outside the 7-day visibility window', async () => {
    const oldId = await insertBookingAt(court, -10, owner.id);
    const res = await request(app).get(`/api/bookings/${oldId}`).set('Authorization', `Bearer ${worker.token}`);
    expect(res.status).toBe(403);
    const ownerRes = await request(app).get(`/api/bookings/${oldId}`).set('Authorization', `Bearer ${owner.token}`);
    expect(ownerRes.status).toBe(200);
  });
});

describe('PATCH /api/bookings/:id', () => {
  it('owner edits details and updated_at changes', async () => {
    const id = await createBooking();
    const res = await request(app).patch(`/api/bookings/${id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ customer_name: 'Renamed Group', total_amount: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.customer_name).toBe('Renamed Group');
    expect(Number(res.body.total_amount)).toBe(1500);
    expect(res.body.updated_at).not.toBe(res.body.created_at);
  });

  it('moving times onto another booking returns the clean 409', async () => {
    const p1 = bookingPayload(court);
    await createBooking();
    const later = new Date(Date.now() + 30 * 3_600_000);
    const id2 = await createBooking({
      booking_date: later.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      start_time: later.toISOString(),
      end_time: new Date(later.getTime() + 2 * 3_600_000).toISOString(),
    });
    const res = await request(app).patch(`/api/bookings/${id2}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ start_time: p1.start_time, end_time: p1.end_time });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This time slot overlaps an existing booking on this court.');
  });

  it('worker cannot edit (403), empty patch is 400', async () => {
    const id = await createBooking();
    const forbidden = await request(app).patch(`/api/bookings/${id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ customer_name: 'Nope' });
    expect(forbidden.status).toBe(403);
    const empty = await request(app).patch(`/api/bookings/${id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({});
    expect(empty.status).toBe(400);
  });
});
