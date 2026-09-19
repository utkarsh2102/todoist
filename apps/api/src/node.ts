import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { migrateDb, openDb } from './db/client';
import { describeDatabase, ensureLocalDbDir, loadLocalEnv } from './local-env';

// Local (and future VPS) entry point: Node server + automatic migrations.
// Production on Netlify wraps createApp() in a function instead and never migrates at runtime.
loadLocalEnv();
const config = loadConfig();
ensureLocalDbDir(config.databaseUrl);

const { db } = await openDb(config.databaseUrl, config.databaseAuthToken);
await migrateDb(db);

const app = createApp({ config, db });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `API listening on http://localhost:${info.port} (${config.appEnv}, db ${describeDatabase(config.databaseUrl)})`,
  );
});
