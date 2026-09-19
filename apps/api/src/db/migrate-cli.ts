import { loadConfig } from '../config';
import { describeDatabase, ensureLocalDbDir, loadLocalEnv } from '../local-env';
import { migrateDb, openDb } from './client';

// `pnpm db:migrate`: applies pending migrations to TURSO_DATABASE_URL (default: local file).
// The deploy workflow runs this against Turso before publishing new code.
loadLocalEnv();
const config = loadConfig();
ensureLocalDbDir(config.databaseUrl);

const handle = await openDb(config.databaseUrl, config.databaseAuthToken);
try {
  await migrateDb(handle.db);
  console.log(`Migrations applied to ${describeDatabase(config.databaseUrl)}`);
} finally {
  handle.close();
}
