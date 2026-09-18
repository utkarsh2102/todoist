# Utkarsh's To-Do

A small, private, Todoist-style task manager: four task queues (Canonical, Freexian, Admin,
Aspirational), a private Project Ideas notebook, browser push reminders, and recurring tasks.
It is built to grow into Google Calendar, Google Tasks, Todoist import, Obsidian and an AI
assistant through clean adapters.

- **Plan & architecture:** [docs/plan-v1.md](docs/plan-v1.md)
- **Decisions:** [docs/decisions/](docs/decisions/)
- **Working on the code (humans and Claude Code):** [CLAUDE.md](CLAUDE.md)

## Status

Phase 0 (bootstrap) of the [implementation phases](docs/plan-v1.md#n-implementation-phases).

## Quick start

Prerequisites: Node.js 24 LTS and pnpm (`corepack enable pnpm`, or install pnpm directly).

```sh
pnpm install
cp .env.example .env.local   # optional in Phase 0; defaults work locally
pnpm dev                     # web on http://localhost:5173, API on :8787 (proxied)
```

## Commands

| Command       | What it does                                         |
| ------------- | ---------------------------------------------------- |
| `pnpm dev`    | Run the web app and API with reload                  |
| `pnpm verify` | Typecheck, lint, format check and tests (CI runs it) |
| `pnpm test`   | Unit and integration tests (Vitest)                  |
| `pnpm build`  | Production build of the web app                      |
| `pnpm format` | Format everything with Prettier                      |

## Layout

```
apps/web         React SPA (Vite), later an installable PWA
apps/api         Hono API: Node server locally, Netlify Functions in production
packages/shared  Code shared by both: schemas, sorting, recurrence, dates
docs/            Plan, decisions (ADRs), runbook
```
