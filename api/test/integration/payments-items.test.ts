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

async function createBooking(): Promise<string> {
  const res = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${owner.token}`)
    .send(bookingPayload(court));
  return res.body.id;
}

describe('payments and items', () => {
  it('worker records a payment and an item; balance math matches the view', async () => {
    const id = await createBooking(); // total 1000
    const pay = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ amount: 500, type: 'advance', method: 'upi' });
    expect(pay.status).toBe(201);
    expect(pay.body.method).toBe('upi');

    const item = await request(app).post(`/api/bookings/${id}/items`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ item_name: 'Water bottle', quantity: 2, unit_price: 20 });
    expect(item.status).toBe(201);
    expect(Number(item.body.total_price)).toBe(40);

    const detail = await request(app).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(Number(detail.body.total_due)).toBe(1040);
    expect(Number(detail.body.total_paid)).toBe(500);
    expect(Number(detail.body.balance_due)).toBe(540);
    expect(detail.body.payments).toHaveLength(1);
    expect(detail.body.items).toHaveLength(1);
  });

  it('rejects non-V1 payment methods and bad amounts with 400', async () => {
    const id = await createBooking();
    const card = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 100, type: 'advance', method: 'card' });
    expect(card.status).toBe(400);
    const zero = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 0, type: 'advance', method: 'cash' });
    expect(zero.status).toBe(400);
    const badQty = await request(app).post(`/api/bookings/${id}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ item_name: 'Snack', quantity: 0, unit_price: 10 });
    expect(badQty.status).toBe(400);
  });

  it('worker cannot pay against a past booking (403)', async () => {
    const oldId = await insertBookingAt(court, -3, owner.id);
    const res = await request(app).post(`/api/bookings/${oldId}/payments`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ amount: 100, type: 'remaining', method: 'cash' });
    expect(res.status).toBe(403);
  });

  it('owner deletes a mis-entered payment; worker cannot', async () => {
    const id = await createBooking();
    const pay = await request(app).post(`/api/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 999, type: 'advance', method: 'cash' });
    const denied = await request(app).delete(`/api/payments/${pay.body.id}`).set('Authorization', `Bearer ${worker.token}`);
    expect(denied.status).toBe(403);
    const deleted = await request(app).delete(`/api/payments/${pay.body.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(deleted.status).toBe(200);
    const detail = await request(app).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(Number(detail.body.total_paid)).toBe(0);
    const again = await request(app).delete(`/api/payments/${pay.body.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(again.status).toBe(404);
  });

  it('owner deletes an item; unknown item is 404', async () => {
    const id = await createBooking();
    const item = await request(app).post(`/api/bookings/${id}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ item_name: 'Snacks', quantity: 1, unit_price: 50 });
    const deleted = await request(app).delete(`/api/items/${item.body.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(deleted.status).toBe(200);
    expect((await request(app).delete('/api/items/00000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${owner.token}`)).status).toBe(404);
  });
});
