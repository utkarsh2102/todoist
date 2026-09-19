import { type Config, loadConfig } from '../src/config';
import { type DbHandle, migrateDb, openDb } from '../src/db/client';

export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({ APP_ENV: 'test', TURSO_DATABASE_URL: ':memory:', ...env });
}

/** A fresh, fully migrated in-memory database per call. */
export async function createTestDb(): Promise<DbHandle> {
  const handle = await openDb(':memory:');
  await migrateDb(handle.db);
  return handle;
}

/** Drizzle wraps driver errors; constraint names live in the error or its cause. */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (err) {
    const messages: string[] = [];
    for (let e: unknown = err; e instanceof Error; e = e.cause) messages.push(e.message);
    if (!messages.some((m) => pattern.test(m))) {
      throw new Error(
        `Expected a database error matching ${pattern}, got: ${messages.join(' <- ')}`,
        { cause: err },
      );
    }
    return;
  }
  throw new Error(`Expected a database error matching ${pattern}, but the statement succeeded`);
}
