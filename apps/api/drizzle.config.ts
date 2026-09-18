import { defineConfig } from 'drizzle-kit';

// Used for `pnpm db:generate` (SQL migrations from src/db/schema.ts). Migrations are applied by
// `pnpm db:migrate` (src/db/migrate-cli.ts), not by drizzle-kit.
export default defineConfig({
  dialect: 'turso',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? 'file:../../.data/todist.db',
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  },
});
