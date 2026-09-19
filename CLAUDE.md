# CLAUDE.md

Guidance for working on this repository. The approved architecture and phase plan is
[docs/plan-v1.md](docs/plan-v1.md); read the relevant section before starting a phase.

## Commands

- `pnpm install` — install (pnpm only; dependency build scripts must be allowed in `pnpm-workspace.yaml`)
- `pnpm dev` — web (Vite, :5173) + API (Hono on Node, :8787); Vite proxies `/api` and `/auth`
- `pnpm verify` — typecheck + lint + format check + tests; **must pass before a phase is done**
- `pnpm test` — Vitest across `apps/*` and `packages/*`
- `pnpm build` — production build of the web app
- `pnpm db:generate` — create a SQL migration from `apps/api/src/db/schema.ts` (review the SQL!)
- `pnpm db:migrate` / `pnpm db:seed` — apply migrations / add dev sample data (local `.data/todist.db`)

## Database

- SQLite via libSQL: `.data/todist.db` locally, `:memory:` in tests (`test/helpers.ts#createTestDb`),
  Turso in production. Drizzle ORM; schema in `apps/api/src/db/schema.ts`.
- Reference data (the four categories) is seeded by a custom migration, so it exists everywhere.
- CHECK constraints back up Zod validation. Remember SQL three-valued logic: a CHECK passes when
  it evaluates to NULL, so write `x IS NOT NULL AND x IN (…)` where NULL must be rejected.

## Layout

- `apps/web` — React SPA. Server state via TanStack Query (from Phase 4).
- `apps/api` — Hono app. `src/app.ts` builds the app; `src/node.ts` is the local entry;
  Netlify Functions wrap the same app (Phase 8). Config only via `src/config.ts`.
- `packages/shared` — isomorphic code used by both (Zod schemas, sort, recurrence, dates).
  Imported as TypeScript source (`@todist/shared`), no build step.

## Guardrails

- Stay within the current phase's scope (plan section N). v1 must not include Calendar, Tasks,
  Docs, Todoist, Obsidian or AI code — integrations exist only as ports.
- `apps/api/src/core/**` must not import `adapters/`, `http/`, Hono or vendor SDKs (ESLint enforces it).
- Every endpoint: Zod-validated input, a `policy.can()` check in the service, and an
  authorization test covering every role.
- Every state change writes an `activity_log` row in the same transaction.
- Migrations are generated with drizzle-kit, never edited once applied, and additive only
  (expand → deploy → contract).
- No secrets in code or tests; read configuration through `config.ts`. Local secrets live in
  `.env.local` (gitignored); document new variables in `.env.example`.
- New dependencies need a one-line justification in the PR/commit message.
- Markdown is rendered only through the safe renderer; `dangerouslySetInnerHTML` is banned by lint.

## Tooling notes

- TypeScript is pinned to 6.0.x because typescript-eslint supports `<6.1`; revisit when it
  supports TypeScript 7.
- `@types/node` follows the Node major in `.nvmrc` (24).
- `docs/` is excluded from Prettier to keep hand-written docs as authored.
