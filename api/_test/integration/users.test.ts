import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../_src/app';
import { resetDb, seedUser, type TestUser } from '../helpers';

let owner: TestUser;
let worker: TestUser;

beforeAll(async () => {
  await resetDb();
  owner = await seedUser('owner');
  worker = await seedUser('worker');
});

describe('user management', () => {
  it('owner views the worker account without the password hash', async () => {
    const res = await request(app).get('/api/users/worker').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('worker');
    expect(res.body.password_hash).toBeUndefined();
    expect((await request(app).get('/api/users/worker')
      .set('Authorization', `Bearer ${worker.token}`)).status).toBe(403);
  });

  it('owner cannot deactivate their own account', async () => {
    const res = await request(app).patch(`/api/users/${owner.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ is_active: false });
    expect(res.status).toBe(403);
    const login = await request(app).post('/api/auth/login')
      .send({ identifier: '9000000001', password: 'password123' });
    expect(login.status).toBe(200);
  });

  it('owner updates the worker name and deactivates the account; login then fails', async () => {
    const res = await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'New Worker Name', is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Worker Name');
    const login = await request(app).post('/api/auth/login')
      .send({ identifier: '9000000002', password: 'password123' });
    expect(login.status).toBe(401);
    await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ is_active: true });
  });

  it('worker changes own password and can log in with it', async () => {
    const res = await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ password: 'newpassword9' });
    expect(res.status).toBe(200);
    const login = await request(app).post('/api/auth/login')
      .send({ identifier: '9000000002', password: 'newpassword9' });
    expect(login.status).toBe(200);
  });

  it('worker cannot change own name or anyone else', async () => {
    expect((await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ name: 'Sneaky' })).status).toBe(403);
    expect((await request(app).patch(`/api/users/${owner.id}`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ password: 'hacked12345' })).status).toBe(403);
  });

  it('owner changes own password; short passwords and empty patches are 400', async () => {
    const ok = await request(app).patch(`/api/users/${owner.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ password: 'ownerpass99' });
    expect(ok.status).toBe(200);
    expect((await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ password: 'short' })).status).toBe(400);
    expect((await request(app).patch(`/api/users/${worker.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})).status).toBe(400);
  });
});
