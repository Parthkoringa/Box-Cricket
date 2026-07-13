import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { db } from '../src/db';

export interface TestUser {
  id: string;
  role: 'owner' | 'worker';
  token: string;
}

/** Wipe all mutable data. Venue/court seed rows from schema.sql are kept. */
export async function resetDb(): Promise<void> {
  await db().query('TRUNCATE bookings CASCADE');
  await db().query('DELETE FROM users');
}

export async function seedUser(role: 'owner' | 'worker'): Promise<TestUser> {
  const phone = role === 'owner' ? '9000000001' : '9000000002';
  const hash = bcrypt.hashSync('password123', 4); // low cost: tests only
  const rows = await db().query(
    'INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [`Test ${role}`, phone, hash, role],
  ) as unknown as Array<{ id: string }>;
  const id = rows[0].id as string;
  const token = jwt.sign({ sub: id, role, name: `Test ${role}` }, config.jwtSecret, { expiresIn: '1h' });
  return { id, role, token };
}

export async function courtId(): Promise<string> {
  const rows = await db().query('SELECT id FROM courts LIMIT 1') as unknown as Array<{ id: string }>;
  return rows[0].id as string;
}

/** Valid create-booking payload starting 3h from now, 2h long. */
export function bookingPayload(court: string, overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 3 * 3_600_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  return {
    court_id: court,
    customer_name: 'Test Customer',
    customer_phone: '9876543210',
    booking_date: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    total_amount: 1000,
    ...overrides,
  };
}

/** Directly insert a booking offset by whole days (negative = past). Returns its id. */
export async function insertBookingAt(court: string, daysOffset: number, createdBy: string): Promise<string> {
  const start = new Date(Date.now() + daysOffset * 86_400_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  const rows = await db().query(
    `INSERT INTO bookings (court_id, customer_name, customer_phone, booking_date, start_time, end_time, total_amount, created_by)
     VALUES ($1, 'Offset Customer', '9000000009', $2, $3, $4, 500, $5) RETURNING id`,
    [court, start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), start.toISOString(), end.toISOString(), createdBy],
  ) as unknown as Array<{ id: string }>;
  return rows[0].id as string;
}
