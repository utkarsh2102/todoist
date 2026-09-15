# ADR 0001: Stack and hosting

- **Status:** Accepted (2026-09-27)
- **Details:** [plan-v1.md](../plan-v1.md), sections B and K

## Context

A private task manager for two people (Owner and one Editor) that must work on phone and
desktop, send reminders as browser push notifications, autosave across devices, and later
integrate Google Calendar/Tasks/Docs, Todoist import, Obsidian and an AI assistant. The owner
already hosts `utkarsh2102.org` on Netlify and does not want to run a VPS yet. GitHub Actions
cannot host the app (no inbound requests, no persistent storage, unreliable schedules).

## Decision

- **TypeScript end to end** (pnpm workspace): React + Vite SPA, Hono API, shared Zod schemas and
  domain logic (sorting, recurrence) used by both client and server.
- **Hosting:** Netlify — static SPA, the API as a Netlify Function, and a per-minute Scheduled
  Function for reminders and the weekly archive sweep. Custom domain `todo.utkarsh2102.org`.
- **Database:** SQLite via libSQL — a local file in development and tests, Turso in production.
  Drizzle ORM and drizzle-kit migrations.
- **CI/CD:** GitHub Actions runs tests, applies migrations and deploys with the Netlify CLI;
  Netlify's own Git builds are disabled. Nightly encrypted backups run in Actions.
- **Development is local-first:** the same Hono app runs as a Node server with an in-process
  scheduler.

## Alternatives considered

Next.js (SSR buys nothing behind a login; blurs the API boundary), Python/Django (UI needs
JavaScript anyway; Netlify Functions don't run Python), Go + TS (good, but two languages and no
shared domain code), BaaS such as Supabase/Firebase/PocketBase (business rules scatter into
policies; free-tier pausing). Hosting: Cloudflare Workers + D1 (strong fallback), a free VM,
Vercel Hobby (daily cron only), GitHub Pages/Actions (not viable). Database: Neon Postgres (the
per-minute scheduler would exceed free compute), Supabase (pausing), Netlify Blobs (no relational
queries).

## Consequences

- The API must be stateless and every scheduled job idempotent (claims, boundary-based sweep,
  unique constraints).
- Reminder precision is about one minute.
- Netlify credits must be watched if the account is on a credit-based plan (15 credits per
  production deploy; exhaustion pauses all sites on the account).
- Moving to a VPS later is a deployment change: the app already runs as a Node server and the
  data exports to a SQLite file.
- Tooling: TypeScript is pinned to 6.0.x until typescript-eslint supports TypeScript 7.
