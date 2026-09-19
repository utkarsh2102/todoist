import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Helpers for the local entry points (server, migrate, seed). Netlify Functions never use them.

/** Loads the repo-root .env.local (gitignored) if present. Existing variables win. */
export function loadLocalEnv(): void {
  const envFile = fileURLToPath(new URL('../../../.env.local', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

/** SQLite creates the database file but not its directory. */
export function ensureLocalDbDir(databaseUrl: string): void {
  if (!databaseUrl.startsWith('file:')) return;
  mkdirSync(dirname(databaseUrl.slice('file:'.length)), { recursive: true });
}

/** For logs: never print credentials embedded in a database URL. */
export function describeDatabase(databaseUrl: string): string {
  return databaseUrl.startsWith('file:') ? databaseUrl : databaseUrl.replace(/\?.*$/, '');
}
