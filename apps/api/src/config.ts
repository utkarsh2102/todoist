import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Every environment variable the API reads is declared here; nothing else touches process.env.
// Later phases add Google, VAPID and secret settings (see .env.example).
const EnvSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Loopback by default so a local server is never reachable from the network.
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    APP_ORIGIN: z.url().default('http://localhost:5173'),
    COMMIT_SHA: z.string().min(1).default('dev'),
    TURSO_DATABASE_URL: z.string().min(1).optional(),
    TURSO_AUTH_TOKEN: z.string().min(1).optional(),
    OWNER_EMAIL: z.email().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production' && !env.TURSO_DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURSO_DATABASE_URL'],
        message: 'is required in production',
      });
    }
  });

export interface Config {
  appEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  appOrigin: string;
  commitSha: string;
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  ownerEmail: string | undefined;
}

/** Local default: <repo>/.data/todist.db (gitignored). Never used in production. */
export const LOCAL_DATABASE_URL = `file:${fileURLToPath(new URL('../../../.data/todist.db', import.meta.url))}`;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  return {
    appEnv: e.APP_ENV,
    host: e.HOST,
    port: e.PORT,
    appOrigin: e.APP_ORIGIN,
    commitSha: e.COMMIT_SHA,
    databaseUrl: e.TURSO_DATABASE_URL ?? LOCAL_DATABASE_URL,
    databaseAuthToken: e.TURSO_AUTH_TOKEN,
    ownerEmail: e.OWNER_EMAIL?.toLowerCase(),
  };
}
