import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { APP_NAME } from '@todist/shared';
import type { Config } from './config';
import type { Db } from './db/client';

export interface AppDeps {
  config: Config;
  db: Db;
}

// Builds the runtime-agnostic Hono app. Entry points (node.ts locally, Netlify Functions in
// production, app.request() in tests) only adapt this to their runtime.
export function createApp({ config, db }: AppDeps) {
  const app = new Hono();

  // Unauthenticated liveness + database check. Reveals nothing beyond the deployed commit.
  app.get('/api/health', async (c) => {
    const body = { app: APP_NAME, commit: config.commitSha };
    try {
      await db.run(sql`SELECT 1`);
      return c.json({ status: 'ok', ...body });
    } catch (err) {
      console.error('health: database check failed', err);
      return c.json({ status: 'error', ...body }, 503);
    }
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
