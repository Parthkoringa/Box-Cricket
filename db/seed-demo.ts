import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const sql = neon(required('DATABASE_URL'));
const IST = 'Asia/Kolkata';
const HOUR = 3_600_000;
const DAY = 86_400_000;

const istDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: IST });

/** A slot `days` days from now starting at `hour` IST (0-23), `len` hours long. */
function slot(days: number, hour: number, len = 2) {
  const now = new Date();
  const base = new Date(now.getTime() + days * DAY);
  const [y, m, d] = istDate(base).split('-').map(Number);
  // IST is UTC+5:30 fixed — construct the UTC instant for that IST wall time
  const start = new Date(Date.UTC(y, m - 1, d, hour - 5, -30));
  return { date: istDate(start), start, end: new Date(start.getTime() + len * HOUR) };
}

const NAMES = [
  ['Ravi Patel', '9898012340'], ['Suresh Shah', '9909055511'], ['Kiran Mehta', '9737088220'],
  ['Amit Desai', '9824071119'], ['Night Owls CC', '9090930303'], ['Parekh Brothers', '9811044556'],
  ['Galaxy Traders XI', '9427314151'], ['Morning Regulars', '9016162626'], ['Jay Thakor', '9725501122'],
  ['Vivek & Friends', '9313972648'], ['Sunrise Strikers', '9879811223'], ['Hardik Joshi', '9265307781'],
] as const;
let n = 0;
const who = () => NAMES[n++ % NAMES.length];

const ITEMS: Array<[string, number, number]> = [
  ['Water bottle', 4, 20], ['Snacks', 2, 50], ['Tape ball', 1, 60], ['Energy drink', 2, 80],
];

async function main() {
  const wipeOnly = process.argv.includes('--wipe');

  // Validate the target DB BEFORE any destructive statement — a misconfigured
  // DATABASE_URL must fail here, not after the wipe.
  const owners = await sql.query(`SELECT id, role FROM users`);
  const owner = owners.find((u: Record<string, unknown>) => u['role'] === 'owner');
  const worker = owners.find((u: Record<string, unknown>) => u['role'] === 'worker');
  if (!owner || !worker) throw new Error('Owner/worker accounts missing — run `npm run seed:users` first.');
  const courts = await sql.query('SELECT id FROM courts LIMIT 1');
  if (!courts[0]) throw new Error('No court found — apply db/schema.sql first.');
  const court = courts[0]['id'];

  const host = new URL(required('DATABASE_URL').replace(/^postgres(ql)?:/, 'https:')).host;
  console.log(`WIPING all bookings on ${host} ...`);
  await sql.query('TRUNCATE bookings CASCADE');
  console.log('Cleared all bookings (payments/items cascade).');
  if (wipeOnly) return;

  let count = 0;
  async function booking(opts: {
    days: number; hour: number; len?: number; total: number;
    status?: 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';
    advance?: number; remaining?: boolean; items?: number; reason?: string;
    startAt?: Date; endAt?: Date; date?: string;
  }) {
    const s = opts.startAt ? { date: opts.date!, start: opts.startAt, end: opts.endAt! } : slot(opts.days, opts.hour, opts.len);
    const [name, phone] = who();
    const status = opts.status ?? 'confirmed';
    const forfeited = status === 'cancelled' || status === 'no_show';
    const rows = await sql.query(
      `INSERT INTO bookings (court_id, customer_name, customer_phone, booking_date, start_time, end_time,
        total_amount, status, advance_forfeited, cancellation_reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [court, name, phone, s.date, s.start.toISOString(), s.end.toISOString(),
       opts.total, status, forfeited, opts.reason ?? null, owner!['id']],
    );
    const id = rows[0]['id'];
    if (opts.advance) {
      await sql.query(
        `INSERT INTO payments (booking_id, amount, type, method, collected_by, paid_at)
         VALUES ($1,$2,'advance',$3,$4,$5)`,
        [id, opts.advance, count % 2 ? 'upi' : 'cash', owner!['id'],
         new Date(s.start.getTime() - 2 * DAY).toISOString()],
      );
    }
    let itemsTotal = 0;
    for (let i = 0; i < (opts.items ?? 0); i++) {
      const [item, qty, price] = ITEMS[(count + i) % ITEMS.length];
      itemsTotal += qty * price;
      await sql.query(
        `INSERT INTO booking_items (booking_id, item_name, quantity, unit_price, added_by, added_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, item, qty, price, worker!['id'], new Date(s.start.getTime() + HOUR).toISOString()],
      );
    }
    if (opts.remaining) {
      await sql.query(
        `INSERT INTO payments (booking_id, amount, type, method, collected_by, paid_at)
         VALUES ($1,$2,'remaining',$3,$4,$5)`,
        [id, opts.total + itemsTotal - (opts.advance ?? 0), count % 3 ? 'cash' : 'upi', worker!['id'],
         new Date(s.end.getTime()).toISOString()],
      );
    }
    count++;
  }

  // -- past 14 days: completed games with full trails (2/day-ish), varied hours
  for (let d = 14; d >= 2; d -= 2) {
    await booking({ days: -d, hour: 7, total: 900 + (d % 3) * 100, status: 'completed', advance: 300, remaining: true, items: d % 2 });
    await booking({ days: -d, hour: 20, total: 1200, status: 'completed', advance: 400, remaining: true, items: (d + 1) % 3 });
  }
  // completed but balance still due (pending report)
  await booking({ days: -3, hour: 18, total: 1000, status: 'completed', advance: 400, items: 1 });
  await booking({ days: -1, hour: 21, total: 1400, status: 'completed', advance: 500 });
  // cancelled + no-show with forfeited advances
  await booking({ days: -5, hour: 16, total: 1000, status: 'cancelled', advance: 300, reason: 'Rain — customer called off' });
  await booking({ days: -2, hour: 17, total: 1200, status: 'cancelled', advance: 400, reason: 'Team short of players' });
  await booking({ days: -4, hour: 22, total: 1000, status: 'no_show', advance: 300 });
  // today: ALL relative to run time so the exclusion constraint can never fire
  const nowIst = new Date();
  const rel = (fromMin: number, toMin: number) => ({
    days: 0, hour: 0,
    date: istDate(new Date(nowIst.getTime() + fromMin * 60_000)),
    startAt: new Date(nowIst.getTime() + fromMin * 60_000),
    endAt: new Date(nowIst.getTime() + toMin * 60_000),
  });
  // finished 2h ago
  await booking({ ...rel(-240, -120), total: 900, status: 'completed', advance: 300, remaining: true, items: 1 });
  // in progress, ends in 15 min (gap of 10 min before the reminder booking)
  await booking({ ...rel(-105, 15), total: 1100, status: 'arrived', advance: 400, items: 2 });
  // the reminder trigger: confirmed, starts ~25 minutes from run time
  await booking({ ...rel(25, 145), total: 1000, advance: 300 });
  // next 7 days: confirmed with/without advances
  await booking({ days: 1, hour: 19, total: 1200, advance: 400 });
  await booking({ days: 1, hour: 21, total: 900 });
  await booking({ days: 2, hour: 18, total: 1000, advance: 300 });
  await booking({ days: 3, hour: 20, total: 1600, advance: 600 });
  await booking({ days: 4, hour: 19, total: 1200 });
  await booking({ days: 5, hour: 7, total: 800, advance: 200 });
  await booking({ days: 6, hour: 20, total: 1400, advance: 500 });

  console.log(`Seeded ${count} demo bookings (statuses: completed/arrived/confirmed/cancelled/no_show).`);
  console.log('Reminder trigger: a confirmed booking starts ~25 minutes from now.');
  console.log('Wipe everything later with: npm run seed:demo -- --wipe');
}

await main();
