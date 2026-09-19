# Utkarsh's To-Do

A small, private, Todoist-style task manager: four task queues (Canonical, Freexian, Admin,
Aspirational), a private Project Ideas notebook, browser push reminders, and recurring tasks.
It is built to grow into Google Calendar, Google Tasks, Todoist import, Obsidian and an AI
assistant through clean adapters.

- **Plan & architecture:** [docs/plan-v1.md](docs/plan-v1.md)
- **Decisions:** [docs/decisions/](docs/decisions/)
- **Working on the code (humans and Claude Code):** [CLAUDE.md](CLAUDE.md)

## Status

Phases 0 (bootstrap) and 1 (data model and shared domain) of the
[implementation phases](docs/plan-v1.md#n-implementation-phases) are done. There is no task UI
yet; the page only reports whether the API and database are reachable.

## Quick start

Prerequisites: Node.js 24 LTS and pnpm (`corepack enable pnpm`, or install pnpm directly).

```sh
pnpm install
cp .env.example .env.local   # optional for now; defaults work locally
pnpm db:seed                 # optional: sample users and tasks in .data/todist.db
pnpm dev                     # web on http://localhost:5173, API on :8787 (proxied)
```

The API applies database migrations automatically when it starts locally.

## Commands

| Command            | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `pnpm dev`         | Run the web app and API with reload                  |
| `pnpm verify`      | Typecheck, lint, format check and tests (CI runs it) |
| `pnpm test`        | Unit and integration tests (Vitest)                  |
| `pnpm build`       | Production build of the web app                      |
| `pnpm format`      | Format everything with Prettier                      |
| `pnpm db:migrate`  | Apply database migrations (local file by default)    |
| `pnpm db:seed`     | Add sample data for local development                |
| `pnpm db:generate` | Create a migration after changing the schema         |

## Layout

```
apps/web         React SPA (Vite), later an installable PWA
apps/api         Hono API: Node server locally, Netlify Functions in production
packages/shared  Code shared by both: schemas, sorting, recurrence, dates
docs/            Plan, decisions (ADRs), runbook
```
