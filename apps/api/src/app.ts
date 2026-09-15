import { Hono } from 'hono';
import { APP_NAME } from '@todist/shared';
import type { Config } from './config';

// Builds the runtime-agnostic Hono app. Entry points (node.ts locally, Netlify Functions in
// production, app.request() in tests) only adapt this to their runtime.
export function createApp(config: Config) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ status: 'ok', app: APP_NAME, commit: config.commitSha }));

  return app;
}

export type App = ReturnType<typeof createApp>;
