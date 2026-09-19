import { loadConfig } from '../config';
import { describeDatabase, ensureLocalDbDir, loadLocalEnv } from '../local-env';
import { migrateDb, openDb } from './client';
import { seedDevData } from './dev-seed';

// `pnpm db:seed`: sample users and tasks for local development. Refuses to run in production.
loadLocalEnv();
const config = loadConfig();
if (config.appEnv === 'production') {
  console.error('Refusing to seed sample data when APP_ENV=production.');
  process.exit(1);
}
ensureLocalDbDir(config.databaseUrl);

const handle = await openDb(config.databaseUrl, config.databaseAuthToken);
try {
  await migrateDb(handle.db);
  await seedDevData(handle.db, {
    ownerEmail: config.ownerEmail ?? 'owner@example.test',
    editorEmail: 'editor@example.test',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: Date.now(),
  });
  console.log(`Sample data seeded into ${describeDatabase(config.databaseUrl)}`);
} finally {
  handle.close();
}
