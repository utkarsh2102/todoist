import { fileURLToPath } from 'node:url';
import { type Client, createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export type Db = LibSQLDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  client: Client;
  close(): void;
}

// url: 'file:/abs/path.db' locally, ':memory:' in tests, 'libsql://…' (Turso) in production.
export async function openDb(url: string, authToken?: string): Promise<DbHandle> {
  const client = createClient(authToken ? { url, authToken } : { url });
  if (url.startsWith('file:')) {
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA busy_timeout = 5000');
  }
  await client.execute('PRAGMA foreign_keys = ON');
  return { db: drizzle(client, { schema }), client, close: () => client.close() };
}

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));

// Applies pending migrations (idempotent). Used by the local server, tests and the deploy job;
// production functions never migrate.
export async function migrateDb(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
