import { z } from 'zod';

// Every environment variable the API reads is declared here; nothing else touches process.env.
// Later phases add Google, database, VAPID and secret settings (see .env.example).
const EnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  COMMIT_SHA: z.string().min(1).default('dev'),
});

export interface Config {
  appEnv: 'development' | 'test' | 'production';
  port: number;
  appOrigin: string;
  commitSha: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  return {
    appEnv: e.APP_ENV,
    port: e.PORT,
    appOrigin: e.APP_ORIGIN,
    commitSha: e.COMMIT_SHA,
  };
}
