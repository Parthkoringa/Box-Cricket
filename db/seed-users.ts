import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} — usage:
  OWNER_NAME=.. OWNER_PHONE=.. OWNER_PASSWORD=.. WORKER_NAME=.. WORKER_PHONE=.. WORKER_PASSWORD=.. npm run seed:users`);
  return value;
}

const sql = neon(required('DATABASE_URL'));

async function upsertUser(role: 'owner' | 'worker', name: string, phone: string, email: string | null, password: string) {
  const hash = await bcrypt.hash(password, 10);
  await sql.query(
    `INSERT INTO users (name, phone, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (phone) DO UPDATE
       SET name = EXCLUDED.name, email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash, is_active = TRUE, updated_at = now()`,
    [name, phone, email, hash, role],
  );
  console.log(`Seeded ${role}: ${name} (${phone})`);
}

await upsertUser('owner', required('OWNER_NAME'), required('OWNER_PHONE'), process.env.OWNER_EMAIL ?? null, required('OWNER_PASSWORD'));
await upsertUser('worker', required('WORKER_NAME'), required('WORKER_PHONE'), process.env.WORKER_EMAIL ?? null, required('WORKER_PASSWORD'));
