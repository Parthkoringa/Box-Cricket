import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../_src/app.js';
import { db } from '../../_src/db.js';
import { bookingPayload, courtId, insertBookingAt, resetDb, seedUser, type TestUser } from '../helpers.js';

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

async function createBooking(): Promise<string> {
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court));
  return res.body.id;
}

const act = (id: string, action: string, token: string, body: object = {}) =>
  request(app).post(`/api/bookings/${id}/${action}`).set('Authorization', `Bearer ${token}`).send(body);

describe('status transitions', () => {
  it('worker walks confirmed → arrived → completed', async () => {
    const id = await createBooking();
    expect((await act(id, 'arrive', worker.token)).body.status).toBe('arrived');
    expect((await act(id, 'complete', worker.token)).body.status).toBe('completed');
  });

  it('completing a confirmed booking is 422', async () => {
    const id = await createBooking();
    const res = await act(id, 'complete', worker.token);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('cancel is owner-only, records reason, forfeits advance', async () => {
    const id = await createBooking();
    expect((await act(id, 'cancel', worker.token, { reason: 'x' })).status).toBe(403);
    const res = await act(id, 'cancel', owner.token, { reason: 'Customer called off' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.advance_forfeited).toBe(true);
    expect(res.body.cancellation_reason).toBe('Customer called off');
  });

  it('no-show by worker forfeits advance', async () => {
    const id = await createBooking();
    const res = await act(id, 'no-show', worker.token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('no_show');
    expect(res.body.advance_forfeited).toBe(true);
  });

  it('cancelling an already-cancelled booking is 422', async () => {
    const id = await createBooking();
    await act(id, 'cancel', owner.token);
    expect((await act(id, 'cancel', owner.token)).status).toBe(422);
  });

  it('worker cannot act on a past booking; owner can', async () => {
    const oldId = await insertBookingAt(court, -3, owner.id);
    expect((await act(oldId, 'arrive', worker.token)).status).toBe(403);
    expect((await act(oldId, 'arrive', owner.token)).status).toBe(200);
  });

  it('acting on an unknown booking is 404', async () => {
    expect((await act('00000000-0000-0000-0000-000000000001', 'arrive', owner.token)).status).toBe(404);
  });
});
