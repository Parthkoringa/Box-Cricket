import { neon } from '@neondatabase/serverless';
import { config } from './config.js';

type NeonClient = ReturnType<typeof neon>;

let client: NeonClient | undefined;

/** Lazily-initialized Neon HTTP client. Usage: await db().query('SELECT ... $1', [x]) */
export function db(): NeonClient {
  client ??= neon(config.databaseUrl);
  return client;
}
