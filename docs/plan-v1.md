# Utkarsh's To-Do — Architecture & v1 Implementation Plan

## Context

You want a personal Todoist-style task manager that you own and can extend:
- four fixed queues: Canonical, Freexian, Admin and Aspirational;
- a private Project Ideas notebook;
- very fast task capture: type, press Enter, done.

It must be private: Google sign-in, with only you and Simran allowed in. It must work well on phone and desktop and remind you through browser notifications. Later it will grow into Google Calendar, Google Tasks and Google Docs integrations, a one-time Todoist import, Obsidian, and an AI assistant, without any of those leaking into the core.

`~/github/todoist` is empty, so this is a new project with no existing code to reuse. v1 is deliberately small. Extension points are designed now but not built.

### Decisions confirmed with you

| Topic | Decision |
|---|---|
| Simran's access | Editor on **all four** task categories. One global role; no per-category grants in v1. |
| Project Ideas | **Private to you** (Owner-only). Hidden from Simran in both the UI and the API. |
| Hosting | **Local-first development.** Production on **Netlify** (your existing account) at `todo.utkarsh2102.org`, with data in **Turso** (hosted SQLite). No VPS. GitHub Actions handles CI/CD and backups; it is not the host. |

### The stack in brief
- TypeScript everywhere.
- **React + Vite** single-page app, installable as a PWA.
- **Hono** API: runs as a Node server locally and as Netlify Functions in production.
- **SQLite via libSQL** (a local file ↔ Turso) with **Drizzle** ORM.
- **Google OIDC** sign-in plus database-backed sessions.
- **Web Push** (VAPID) sent by a **per-minute Netlify Scheduled Function**.
- **GitHub Actions**: test → migrate → deploy, plus nightly encrypted backups.

### Why GitHub Actions or GitHub Pages alone can't host it
- **Nothing to receive requests.** Actions jobs run on throwaway CI machines (max 6 h, then deleted) and can't receive requests from your browser. There's nowhere to run login, the task API or autosave.
- **No storage.** Data would have to be committed back to the repo. Every checkbox would become a commit made with a GitHub token held in the browser, and Simran would need write access to the repo. There would be no Google login and no conflict-safe autosave.
- **Unreliable scheduling.** Scheduled workflows run at most every 5 min, are commonly 5–30+ min late, can be dropped under load, and are auto-disabled after 60 days of inactivity in public repos. That's unusable for reminders.
- **Public pages.** GitHub Pages sites are public, so private data can't live there.
- **What Actions does here:** runs the pipeline and the nightly backup, a job that tolerates delays.

---

## Product & UX specification

### Screens
- **To-Do (home):** a 2×2 grid.
  - Layout: Canonical (top-left), Freexian (top-right), Admin (bottom-left), Aspirational (bottom-right).
  - Each quadrant has a header (name and open count), an always-visible "Add a task…" input, and the sorted list.
  - Quadrants scroll independently.
- **Project Ideas** (Owner only):
  - A list showing title, last edited and first line, with a search box.
  - A Markdown editor with a preview.
- **Completed:**
  - Archived tasks grouped by week of completion.
  - Category filter and text search.
  - Unchecking a task restores it.
- **Settings:**
  - **Profile:** time zone, default reminder time, "hide task titles in notifications".
  - **Devices:** enable notifications on this device, send a test, sign in another device with a code, active sessions.
  - **Members** (Owner): invite by Google email, change role, disable.
  - **System** (Owner): last reminder run, last sweep, data export.

### Responsive layout
- **≥1100 px:** 2×2 grid. Task detail opens as a right-side drawer. The drawer is **non-modal**: the board stays usable, and Esc closes it.
- **700–1099 px (tablet):** 2×2 grid with tighter type. The drawer overlays the right half.
- **<700 px (phone):**
  - One quadrant at a time, chosen from a segmented control ("Canonical 4 · Freexian 7 · Admin 3 · Aspire 9"). The last tab used is remembered.
  - Bottom bar: To-Do · Ideas · Completed · Settings.
  - Task detail is a full-screen page (`/tasks/:id`); Back closes it.
  - Touch targets are at least 44 px.
  - Dates and times use the **native date/time inputs**: the best pickers on mobile, with no dependencies.

### Quick add (UX requirement #1)
- Type a title and press Enter. The task appears **instantly**: it is created on screen immediately with an ID generated in the browser, then saved in the background. The input clears and keeps focus, and the new card scrolls into view with a brief highlight.
- Defaults: category = the quadrant, assignee = you, everything else empty.
- No natural-language parsing in v1. Tokens such as `p1`, `tomorrow` or `30m` can come later.
- Desktop keys:
  - `n` focuses the quick-add input of the last quadrant used.
  - `1`–`4` jump to a quadrant.
  - `Esc` closes the drawer.

### Task card (progressive disclosure level 1)
```
▌☐  Submit GST documents                          P1
▌   10 Oct · 30m · ↻ · SK
```
- **Line 1:** checkbox, **bold title** (up to 2 lines), priority chip.
- **Line 2** (muted, only for fields that are set):
  - due date ("Today", "Tomorrow", "2 Oct"), shown in red when overdue;
  - duration ("15m", "1h", "1h 30m");
  - ↻ if the task recurs, 🔔 if it has reminders;
  - assignee initials, **only when the assignee isn't you**.
- A 4 px left stripe in the priority colour.
- **Completed tasks:** checked, struck through and muted, showing "Done 27 Sep".

### Task detail (level 2): everything autosaves
- There is no Save button. A small status shows "Saving…", "Saved", "Offline — will retry" or "Conflict".
- Fields, in order:
  1. title
  2. category
  3. priority: chips for P0, P1, P2, P3, P4, Wish and none
  4. due date, with an optional time
  5. duration: chips for 15, 20, 30, 45, 60, 90 and 120 min, plus custom
  6. assignee
  7. repeat
  8. reminders
  9. links: URL plus optional label
  10. description: Markdown, with Edit and Preview
- Footer: when the task was created, updated and completed, and by whom; Delete, with an Undo toast.

### Priority palette (checked for accessibility)
Label text is always shown, so colour is never the only cue. **P0 is the only filled chip**, so "critical" stands out even for colour-blind users.

The hues run red → orange → amber → blue → slate → green. Each cell gives the colours and the contrast ratio.

| Level | Meaning | Light chip | Light stripe | Dark chip | Dark stripe |
|---|---|---|---|---|---|
| P0 | Critical | `#FFFFFF` on `#D92D20` · 4.8:1 | `#D92D20` · 4.8:1 | `#FFFFFF` on `#D92D20` · 4.8:1 | `#F04438` · 4.6:1 |
| P1 | High | `#B93815` on `#FFE6D5` · 4.8:1 | `#E04F16` · 4.0:1 | `#FDA27F` on `#511C10` · 7.0:1 | `#F38744` · 6.9:1 |
| P2 | Medium | `#93370D` on `#FEF0C7` · 6.6:1 | `#DC6803` · 3.5:1 | `#FEC84B` on `#4E1D09` · 9.0:1 | `#F79009` · 7.3:1 |
| P3 | Normal | `#175CD3` on `#D1E9FF` · 4.8:1 | `#2E90FA` · 3.2:1 | `#84CAFF` on `#102A56` · 8.0:1 | `#53B1FD` · 7.5:1 |
| P4 | Low | `#475467` on `#EAECF0` · 6.5:1 | `#667085` · 5.0:1 | `#D0D5DD` on `#344054` · 7.1:1 | `#667085` · 3.5:1 |
| Wish | Someday | `#067647` on `#DCFAE6` · 5.1:1 | `#079455` · 3.9:1 | `#75E0A7` on `#053321` · 8.6:1 | `#47CD89` · 8.5:1 |
| none | untriaged | no chip | neutral border | no chip | neutral border |

- **What was checked:**
  - Chip text meets WCAG AA (≥4.5:1) against the chip background.
  - Stripes meet WCAG non-text contrast (≥3:1) against the card: `#FFFFFF` in light mode, `#161B26` in dark mode.
  - Overdue date text is `#D92D20` (4.8:1) in light mode and `#F97066` (6.2:1) in dark mode.
- **Theming:** the colours are defined once as CSS custom properties in `apps/web/src/styles/tokens.css`. Light and dark follow the system setting.

---

## A. Recommended architecture

```
 Browser / installed PWA (desktop, iPhone, Android)
 ┌───────────────────────────────────────────────────┐
 │ React SPA · TanStack Query · autosave engine      │
 │ Service worker: push display + notification click │
 └───────────────┬───────────────────────────────────┘
                 │ HTTPS, same origin (todo.utkarsh2102.org), session cookie
 ┌───────────────▼──────────────────────────────────────────────────┐
 │ Netlify                                                           │
 │   CDN: static SPA (index.html, hashed JS/CSS, manifest, sw.js)    │
 │   Function "api"        /api/*, /auth/*   ─┐                      │
 │   Scheduled "scheduler" every minute      ─┤ same Hono app + core │
 └────────────────────────────────────────────┼──────────────────────┘
                                              │ libSQL over HTTPS
                                       ┌──────▼──────┐   ┌─────────────────────────┐
                                       │ Turso (DB)  │   │ Push services           │
                                       └─────────────┘   │ FCM · Mozilla · APNs    │
   scheduler ── web-push (VAPID, end-to-end encrypted) ─►└─────────────────────────┘

 GitHub repo ─► Actions: CI → DB migrate → netlify deploy → smoke test · nightly backup
 Local dev: the same Hono app on Node + Vite + SQLite file + in-process interval scheduler
```

### Layering inside the API
```
http/ (Hono routes: session, Origin check, Zod validation)     jobs/runDueJobs(now)
                 │                                                      │
                 ▼                                                      ▼
core/ services: Tasks · Recurrence · Reminders · Archive · Ideas · Members+Policy · Activity
                 │ uses                                   │ calls interfaces only
                 ▼                                        ▼
db/ repositories (Drizzle → libSQL)               ports/: PushSender, Clock, IdentityProvider
                                                  (later) CalendarProvider, TaskSyncProvider,
                                                  Importer, NotesExporter, LLMProvider
                                                          ▲ implemented by
                                                  adapters/: webpush, google-oidc, (later) …
```

### Rules
- **Core stays clean.** `core/` never imports `adapters/`, Hono or vendor SDKs; ESLint `no-restricted-imports` enforces this.
- **Every change is logged.** Each state change writes an **`activity_log`** row in the same transaction. That one table gives you:
  - an audit trail;
  - completion history for the AI later;
  - the **outbox** future integrations read from (a queue of changes that a sync job processes).

### Component responsibilities
- **Frontend:**
  - A single-page app with no server-side rendering. Everything sits behind login, so there's no SEO benefit.
  - TanStack Query handles server state, optimistic updates and refetch-on-focus.
- **API:**
  - One Hono app that keeps nothing in memory between requests.
  - The same code runs in three places: `node.ts` (local), `netlify/functions/api.mts` (production), and `app.request()` in tests.
- **Jobs:**
  - `runDueJobs(now)` runs reminder dispatch, the archive-sweep check and housekeeping.
  - Triggered by Netlify cron in production, by `setInterval` locally, and called directly in tests.
  - Every job is **idempotent** (safe to run twice).
- **Database:** Turso in production, a SQLite file locally, and in-memory libSQL in tests. It's the same SQL dialect everywhere.

---

## B. Technology recommendation

### Stack options

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **TypeScript end-to-end: React SPA + Hono API** | One language. Shared Zod schemas, sort comparator and recurrence engine on client and server, so previews and optimistic re-sorts match exactly. Runs on Node locally and in Netlify Functions. Official/mature libraries for web-push, Google APIs, Anthropic/OpenAI and MCP. | JavaScript ecosystem churn; mitigated by few, mature dependencies. | ✅ **Chosen** |
| Next.js full stack | Popular and integrated. | SSR/SEO buy nothing behind a login. Server actions and RSC caching blur the clean API/service boundary the integrations need. Heavier. | ✗ |
| Python (Django + HTMX, or FastAPI) | Batteries included (admin, auth, CSRF); you know Python. | Autosave, optimistic checkboxes, the service worker and the Markdown editor are JavaScript anyway, so two languages. **Netlify Functions don't run Python** (JS/TS and Go only). | ✗ for this host |
| Go API + TS SPA | Fast single binary; great on a VPS; Netlify supports Go functions. | Two languages; recurrence and sorting duplicated or served only by the server; more auth/session boilerplate. | Runner-up |
| Backend-as-a-service (Supabase / Firebase / PocketBase) | Auth, database and realtime out of the box. | Business rules scatter into access-control policies and edge functions. Free-tier pausing (Supabase), NoSQL modelling (Firebase), pre-1.0 API (PocketBase). Harder to keep integrations as clean adapters. | ✗ |

### Hosting options

| Option | Verdict |
|---|---|
| **Netlify (static + Functions + Scheduled Functions) + Turso** | ✅ **Chosen.** Uses your existing account and domain; $0 expected; no server to run. |
| Cloudflare Workers + D1 + Cron | Good fallback. Most generous free tier, but a new platform, a non-Node runtime, and a 10 ms CPU limit per request on the free plan. |
| Free VM (Oracle / GCP e2-micro) or VPS | Later option if you outgrow serverless. The code already runs as a Node server. |
| Vercel Hobby | ✗. Cron jobs run at most once a day, so it can't send reminders. |
| GitHub Actions / Pages | ✗. See Context. |

### Database options

| Option | Verdict |
|---|---|
| **Turso (libSQL = SQLite)** | ✅ **Chosen.**<br>• Same dialect as the local dev file.<br>• HTTP driver suited to serverless functions.<br>• Free tier: 5 GB storage, 500M row reads and 10M row writes a month. It meters rows, not compute time, so polling every minute costs almost nothing.<br>• Portable: dumps to a plain SQLite file. |
| Neon Postgres / Netlify DB | Postgres is boring in a good way, but the free tier is 100 CU-hours a month. A per-minute scheduler keeps compute awake (≈730 h × 0.25 CU ≈ 180 CU-h), which exceeds it. |
| Supabase Postgres | Free projects pause after inactivity; adds another platform. |
| Netlify Blobs | Key-value only; no relational queries or transactions. |

### Chosen components
- **Runtime and tooling:**
  - Node.js **24 LTS**; switch to 26 LTS after 28 Oct 2026. Match the Netlify Functions runtime to it.
  - pnpm workspaces, TypeScript in strict mode.
- **Web:**
  - React 19 + Vite, React Router, TanStack Query.
  - CSS Modules + CSS variables; no UI kit — native `<dialog>`, `<details>`, `<select>` and date/time inputs first.
  - `react-markdown` + `remark-gfm`.
  - `vite-plugin-pwa` in `injectManifest` mode.
- **API:**
  - Hono with Zod validation (`@hono/zod-validator`).
  - `openid-client` (OpenID-certified) for Google sign-in.
  - `web-push` for notifications.
  - Luxon for time-zone conversion.
  - `uuid` for v7 IDs.
- **Data:** Drizzle ORM + drizzle-kit migrations; `@libsql/client` (file or Turso; the HTTP-only client in functions).
- **Tests:** Vitest, Playwright (desktop plus iPhone/Android viewports), fast-check for property tests on recurrence and sorting.
- **Quality:**
  - ESLint (typescript-eslint, react-hooks, import-boundary rules), Prettier.
  - Dependabot (npm and GitHub Actions), gitleaks.

---

## C. Data model

### Conventions
- **IDs:** UUIDv7 text. They're time-ordered, can be generated by the browser (so retrying a create never duplicates it), and **never change**, even when a task is synced to another service.
- **Instants:** integer UTC epoch milliseconds.
- **Dates:** `YYYY-MM-DD` text, **floating** — "2 Oct" means 2 Oct wherever you are.
- **Times:** `HH:MM`.
- **JSON columns:** validated by shared Zod schemas.
- **Deletes:** soft, via `deleted_at`.
- **Concurrent edits:** each row has a **`version`** counter; a save must name the version it started from (optimistic concurrency).

```sql
-- people & access ------------------------------------------------------------
users(
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,              -- lower-cased Google email (the invite key)
  google_sub TEXT UNIQUE,                  -- Google's stable account id, bound at first sign-in
  name TEXT NOT NULL, avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
  status TEXT NOT NULL CHECK (status IN ('invited','active','disabled')),
  timezone TEXT NOT NULL,                  -- IANA, e.g. 'Asia/Kolkata' (from browser at first login)
  default_reminder_time TEXT NOT NULL DEFAULT '09:00',
  notify_hide_content INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_login_at INTEGER)

sessions(id TEXT PRIMARY KEY /* sha256(token) */, user_id TEXT NOT NULL REFERENCES users,
         label TEXT, user_agent TEXT, created_at INTEGER, last_seen_at INTEGER, expires_at INTEGER NOT NULL)

signin_codes(code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users,
             created_at INTEGER, expires_at INTEGER NOT NULL, used_at INTEGER)   -- device hand-off (see E)

-- tasks ---------------------------------------------------------------------
categories(id TEXT PRIMARY KEY,            -- 'canonical' | 'freexian' | 'admin' | 'aspirational'
           name TEXT NOT NULL,              -- 'Canonical To-Do', … (data, not hard-coded)
           position INTEGER UNIQUE NOT NULL)  -- 0=top-left 1=top-right 2=bottom-left 3=bottom-right

tasks(
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories,
  title TEXT NOT NULL,                      -- 1..300 chars
  description_md TEXT NOT NULL DEFAULT '',  -- ≤ 50 KB
  priority TEXT CHECK (priority IN ('P0','P1','P2','P3','P4','WISH')),   -- NULL = none
  due_date TEXT, due_time TEXT,             -- floating local date / optional time
  duration_min INTEGER CHECK (duration_min BETWEEN 1 AND 1440),
  assignee_id TEXT REFERENCES users,        -- set to owner at creation; NULL = unassigned
  links_json TEXT NOT NULL DEFAULT '[]',    -- [{url, label?}], http(s) only, ≤ 20
  series_id TEXT REFERENCES task_series,    -- recurring instances only
  occurrence_date TEXT,                     -- the scheduled date this instance represents
  completed_at INTEGER, completed_by TEXT REFERENCES users,
  resolution TEXT CHECK (resolution IN ('done','skipped')),  -- set iff completed_at is set
  archived_at INTEGER,                      -- set by the weekly sweep
  deleted_at INTEGER,                       -- soft delete (Undo / restore)
  created_by TEXT NOT NULL REFERENCES users,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1)
-- INDEX (category_id, archived_at, deleted_at)
-- UNIQUE INDEX (series_id, occurrence_date) WHERE series_id IS NOT NULL   ← duplicate guard
-- INDEX (completed_at) WHERE archived_at IS NULL                          ← sweep

task_series(                                -- one row per recurring chain (see G)
  id TEXT PRIMARY KEY,
  rule_json TEXT NOT NULL,                  -- validated Rule
  mode TEXT NOT NULL CHECK (mode IN ('fixed','after_completion')),
  anchor_date TEXT NOT NULL,                -- first occurrence (DTSTART)
  until_date TEXT, max_count INTEGER, created_count INTEGER NOT NULL DEFAULT 1,
  ended_at INTEGER,                         -- "stop repeating"
  created_by TEXT, created_at INTEGER, updated_at INTEGER, version INTEGER NOT NULL DEFAULT 1)

reminders(
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('absolute','relative')),
  on_date TEXT,                             -- absolute: local date
  days_before INTEGER CHECK (days_before BETWEEN 0 AND 365),  -- relative: 0 = on the due date
  at_time TEXT NOT NULL,                    -- recipient-local time, e.g. '09:00'
  fire_at INTEGER,                          -- DERIVED UTC instant; NULL if not computable
  claimed_at INTEGER, sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
  created_at INTEGER, updated_at INTEGER)
-- INDEX (fire_at) WHERE sent_at IS NULL

push_subscriptions(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users,
  endpoint TEXT UNIQUE NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  label TEXT, user_agent TEXT, created_at INTEGER,
  last_success_at INTEGER, last_failure_at INTEGER, failure_count INTEGER NOT NULL DEFAULT 0)

-- notebook (owner-only) -------------------------------------------------------
ideas(id TEXT PRIMARY KEY, title TEXT NOT NULL, body_md TEXT NOT NULL DEFAULT '',   -- body ≤ 500 KB
      created_by TEXT, updated_by TEXT, created_at INTEGER, updated_at INTEGER,
      version INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER)
idea_revisions(id TEXT PRIMARY KEY, idea_id TEXT NOT NULL REFERENCES ideas, version INTEGER,
               title TEXT, body_md TEXT, saved_by TEXT,
               reason TEXT /* 'periodic' | 'before_overwrite' | 'before_restore' */, created_at INTEGER)

-- cross-cutting -----------------------------------------------------------------
activity_log(seq INTEGER PRIMARY KEY AUTOINCREMENT,   -- monotonic outbox cursor
             occurred_at INTEGER NOT NULL, actor_id TEXT /* NULL = system */,
             entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
             type TEXT NOT NULL,        -- task.created|updated|completed|uncompleted|skipped|deleted|restored|archived,
                                        -- series.set|ended, reminder.sent|expired, idea.*, member.*
             data_json TEXT)            -- changed fields {field:[old,new]}; big text = "changed" flag only
-- INDEX (entity_type, entity_id, seq)
app_settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER)
  -- 'workspace.timezone', 'archive.sweep' = {weekday:5, time:'06:00', minAgeDays:7}
job_runs(name TEXT PRIMARY KEY, last_started_at INTEGER, last_success_at INTEGER,
         last_boundary INTEGER, last_error TEXT)
```

### Relationships
- `users` 1—* `sessions`, `push_subscriptions` and `signin_codes`.
- `users` 1—* `tasks`, through three columns: `assignee_id`, `created_by` and `completed_by`.
- `categories` 1—* `tasks`.
- `task_series` 1—* `tasks`: the instances of a recurring task. At most one is open at a time.
- `tasks` 1—* `reminders`.
- `ideas` 1—* `idea_revisions`.
- `activity_log` references any entity through the pair (`entity_type`, `entity_id`).

### Future tables
These are not created in v1. Each arrives in the migration that ships its feature, and **none of them changes `tasks`**.
```sql
integration_accounts(id, provider, user_id, external_account, scopes, refresh_token_enc BLOB,
                     access_token_enc BLOB, access_expires_at, status /* active|needs_reauth|revoked */,
                     settings_json, created_at, updated_at)
external_refs(id, provider, integration_account_id, entity_type /* task|idea */, entity_id,
              external_id, external_container_id /* calendar id · task list id · vault path */,
              etag, sync_state, last_synced_at, data_json,
              UNIQUE(provider, integration_account_id, entity_type, entity_id),
              UNIQUE(provider, integration_account_id, external_id))
integration_cursors(consumer TEXT PRIMARY KEY, last_seq INTEGER)     -- outbox position per integration
api_tokens(id, user_id, name, token_hash, scopes, created_at, last_used_at, expires_at, revoked_at)
                                                                       -- CLI · MCP server · Obsidian plugin
```
The internal ID remains the only identity of a task. External IDs live beside it in `external_refs`.

---

## C.1 Task rules: sorting, completion, weekly archive

### Sorting
This is a pure function in `packages/shared/src/sort.ts`. The server and the client use the same code, so an optimistic re-sort in the browser always matches what the server returns.

```ts
const RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, none: 5, WISH: 6 };

function compareOpen(a, b) {
  return RANK[a.priority ?? 'none'] - RANK[b.priority ?? 'none']   // 1. priority band
      || Number(!a.dueDate) - Number(!b.dueDate)                    // 2. dated before undated
      || cmp(a.dueDate, b.dueDate)                                  // 3. earliest due first (overdue floats up)
      || Number(!a.dueTime) - Number(!b.dueTime)                    // 4. timed before all-day on the same date
      || cmp(a.dueTime, b.dueTime)
      || a.createdAt - b.createdAt                                  // 5. oldest first (FIFO queue)
      || cmp(a.id, b.id);                                           // 6. deterministic tie-break
}
const compareCompleted = (a, b) => b.completedAt - a.completedAt || cmp(a.id, b.id);

// quadrant = [...open.sort(compareOpen), ...completedNotArchived.sort(compareCompleted)]
```

- **Order:** P0 → P1 → P2 → P3 → P4 → *no priority* → Wish List → completed tasks waiting for archival.
- **Unprioritized tasks** sit after P4 and before Wish List: untriaged, but still actionable.
- **Overdue tasks** rise to the top of their priority band automatically, because they have the earliest dates.
- **Completed tasks** list just-completed first, right under the open tasks, so your eye finds the item you just checked.

### Completion
- **Checking a task:**
  - The command `POST /tasks/:id/complete` sets `completed_at`, `completed_by` and `resolution='done'`.
  - It writes an `activity_log` row and, for a recurring task, creates the next instance (see G).
  - The card moves to the muted completed group at the bottom of its quadrant, with an Undo toast.
- **Unchecking:** clears those fields, and the task returns to its sorted place.
- **Deleting:** a soft delete. Completed tasks are **never** deleted by the system.

### Weekly archive sweep
Settings: `app_settings['archive.sweep']`, defaulting to Friday 06:00 in your (the Owner's) time zone, with a minimum age of 7 days.

```
boundary(now) = the most recent Friday 06:00 (owner time zone) ≤ now, as a UTC instant

runArchiveSweep(now):
  b = boundary(now)
  if job_runs['archive'].last_boundary >= b: return          # already done for this week
  cutoff = b − 7 days                                         # computed from b, not from now
  UPDATE tasks SET archived_at = b, version = version + 1
   WHERE completed_at IS NOT NULL AND completed_at <= cutoff
     AND archived_at IS NULL AND deleted_at IS NULL
  write 'task.archived' activity rows; job_runs['archive'].last_boundary = b
```

- **Reliable even when nothing is open:**
  - The sweep runs on the server whether or not any browser is open.
  - The cutoff comes from the boundary, not the clock. A run that is late (Saturday, Monday, after an outage) archives exactly what an on-time Friday run would have; running it twice does nothing.
  - It's checked on every scheduler tick, and again (cheaply) at the start of every `GET /board`. So even if the scheduler had been down, the first page load catches up.
- **Your example:**
  - Completed on Sunday: at Friday's sweep it's 4.8 days old, so it stays. At the next Friday it's 11.8 days old, so it's archived.
  - Completed on Thursday: at Friday's sweep it's 0.75 days old; a week later it's 7.75 days old, so it's archived then.
  - So a completed task stays visible for **7–14 days**.
- **After archiving:** tasks keep `completed_at` and all their history, and appear in the **Completed** view. Unchecking one there restores it (clears `completed_at` and `archived_at`).

---

## D. API design

### Principles
- **Shape:** JSON over HTTPS on the same origin, versioned under `/api/v1`.
- **Auth:** by session cookie.
- **Writes:**
  - Every write must send `Content-Type: application/json`.
  - Its `Origin` header must equal `APP_ORIGIN`.
- **Thin handlers:**
  - Handlers only validate input with Zod (shared schemas), call a **core service**, and map the result.
  - The same services will later back AI tools and an MCP server.
- **Retry-safe creates:** they accept a client-generated UUIDv7, so a retried create never makes a duplicate.
- **Commands for side effects:** state changes with side effects (complete, skip, recurrence) are explicit commands, not generic field updates.
- **Errors:** always `{ "error": { "code", "message", "details?" } }`, where `code` is one of `unauthenticated`, `forbidden`, `not_found`, `validation`, `conflict`, `rate_limited` or `internal`.

### Endpoints

| Area | Endpoint | Notes |
|---|---|---|
| Auth | `GET /auth/google/start?returnTo=/path` | Redirects to Google (PKCE + state + nonce). |
| | `GET /auth/google/callback` | Verify → match member → create session → redirect. |
| | `POST /auth/logout` | Deletes the session (the client also removes this device's push subscription). |
| | `POST /auth/code` | Redeem a one-time sign-in code (iOS Home Screen app). |
| | `GET /auth/dev-login?as=owner\|editor` | **Only** when `APP_ENV` is `development` or `test`; 404 in production. |
| Me | `GET /api/v1/me` · `PATCH /api/v1/me` | Profile, time zone, default reminder time, notification privacy. |
| | `POST /api/v1/me/signin-codes` | Creates a 10-min single-use code to sign in another device. |
| | `GET /api/v1/me/sessions` · `DELETE /api/v1/me/sessions/:id` | "Signed-in devices". |
| Members (owner) | `GET · POST /api/v1/members`, `PATCH · DELETE /api/v1/members/:id` | Invite by email and role, change role, disable (revokes sessions). |
| Board | `GET /api/v1/board` | Categories with counts, open tasks and completed-not-archived tasks (pre-sorted), assignable users, today in your time zone. Runs the lazy sweep check first. |
| Tasks | `POST /api/v1/tasks` | `{id?, categoryId, title, …optional}`; retry-safe on `id`. |
| | `GET /api/v1/tasks/:id` | Full detail: reminders, series summary, recent activity. |
| | `PATCH /api/v1/tasks/:id` | Field-level check-and-save (below). |
| | `POST /api/v1/tasks/:id/complete` · `/uncomplete` · `/skip` | Commands; handle recurrence and reminder side effects. |
| | `DELETE /api/v1/tasks/:id` · `POST /api/v1/tasks/:id/restore` | Soft delete / Undo. |
| | `GET /api/v1/tasks/archived?cursor=&q=&categoryId=` | Completed view, paginated. |
| Recurrence | `PUT /api/v1/tasks/:id/recurrence` · `DELETE …/recurrence` | Set or change the rule; "stop repeating". |
| Reminders | `POST /api/v1/tasks/:id/reminders` · `PATCH · DELETE /api/v1/reminders/:id` | The server computes `fire_at`. |
| Ideas (owner) | `GET · POST /api/v1/ideas`, `GET · PATCH · DELETE /api/v1/ideas/:id`, `POST …/restore` | Owner-only (403 for others). |
| | `GET /api/v1/ideas/:id/revisions[/:revId]` · `POST …/revisions/:revId/restore` | History. |
| Push | `GET /api/v1/push/config` | VAPID public key. |
| | `GET · POST /api/v1/push/subscriptions` · `DELETE …/:id` | Save or update keyed by endpoint (re-assigned to the current user). |
| | `POST /api/v1/push/test` | Send a test to this device or to all of your devices. |
| Ops | `GET /api/health` | No auth. DB ping plus commit SHA; no other details. |
| | `GET /api/v1/admin/jobs` · `GET /api/v1/export` (owner) | Scheduler status; full JSON data export. |

### PATCH semantics
Each save makes a field-level check against what's already stored before writing (compare-and-set).

```jsonc
PATCH /api/v1/tasks/:id
{ "baseVersion": 7,
  "changes": { "priority": "P1", "dueDate": "2026-10-10" },
  "base":    { "priority": "P2", "dueDate": null } }       // values the edit was made against
// 200 → { task }  (version 8)
// 409 → { error: { code: "conflict", details: { current, conflictingFields: ["priority"] } } }
```

- **Long text fields** (`description_md`, `body_md`): the client sends a SHA-256 of the base value instead of the value itself, so large notes don't double the request size.
- **Same version:** if the stored `version` equals `baseVersion`, the change applies.
- **Different version:** for each changed field, if the stored value still equals `base[field]`, nobody else touched it and it's safe. If there are no conflicts, the change applies. This **auto-merges edits to different fields** (e.g. Simran changes the due date while you edit the description).
- **Every successful write:** increments `version` and writes `activity_log` rows.

### Core services
The HTTP layer, jobs, and later AI/MCP all call these:
- `TaskService`: `list`, `get`, `create`, `update`, `complete`, `uncomplete`, `skip`, `delete`, `restore`, `listArchived`.
- `RecurrenceService`: `set`, `stop`, `generateNext`.
- `ReminderService`: `upsert`, `remove`, `recomputeForTask`, `recomputeForUser`, `dispatchDue`.
- `ArchiveService`: `ensureSwept`.
- `IdeaService` (with revisions).
- `MemberService`, plus `policy.can()`.
- `ActivityLog`.

---

## E. Authentication & authorization

### Google setup (manual, one time)
1. Create a Google Cloud project, e.g. `todist`.
2. Configure the OAuth consent screen:
   - User type: **External**.
   - Scopes: `openid email profile` only.
   - Publishing status: **In production**. Basic scopes need no verification, and it avoids later surprises: in *Testing*, refresh tokens for other scopes expire after 7 days.
3. Create an OAuth client of type *Web application*, with these redirect URIs:
   - `https://todo.utkarsh2102.org/auth/google/callback`
   - `http://localhost:5173/auth/google/callback`
4. Store the credentials as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Sign-in flow (server-side)
1. **`/auth/google/start`:**
   - Generates `state`, `nonce` and a PKCE verifier.
   - Stores them, with `returnTo`, in an **encrypted** 10-minute cookie `__Host-oauth_tx` (HttpOnly, Secure, SameSite=Lax).
   - Redirects to Google with `prompt=select_account`, so it's easy to pick your personal account rather than your Canonical one.
2. **`/auth/google/callback`:**
   - `openid-client` exchanges the code and **verifies the ID token**: issuer, audience, expiry, nonce and signature.
   - It requires `email_verified`.
3. **Member matching:**
   - First by `google_sub`.
   - Otherwise by an invited or active email with no `sub` yet, which binds the `sub` from then on.
   - Otherwise, if the email equals `OWNER_EMAIL` and no owner exists yet, create the **owner** (bootstrap).
   - Otherwise, show "This Google account isn't invited", and no data is shown.
4. **Session and redirect:**
   - Create a session and rotate the cookie.
   - Redirect to `returnTo`, which must be a same-origin relative path so it can't be abused as an open redirect.
5. **Google tokens aren't kept.** Login never stores Google access or refresh tokens; the ID token is only used to establish our own session.

### Sessions
- **Token:** 256-bit random. Only its SHA-256 is stored, as `sessions.id`.
- **Cookie:** `__Host-sid`, with HttpOnly, Secure, SameSite=Lax and Path=/.
  - Lax, not Strict, so that opening a link from a notification or email arrives signed in.
- **Lifetime:**
  - Sliding: 60 days, extended at most once a day.
  - Absolute maximum: 1 year.
  - Each device's session can be revoked from Settings.
  - Disabling a member revokes all of their sessions.
- **Dev mode:** a non-`__Host` cookie without Secure over `http://localhost`, controlled by config.

### Invites
Members are managed in Settings → Members (Owner only):
- Add Simran's exact Google email with the role Editor.
- Simran opens the site, signs in with Google, and is activated.
- v1 sends no email; you share the URL.

### Roles
The permission matrix lives in `apps/api/src/core/members/policy.ts`.

| Capability | Owner (you) | Editor (Simran) | Viewer (future) |
|---|---|---|---|
| Read tasks in all 4 categories; Completed view | ✓ | ✓ | ✓ |
| Create, edit, complete, delete or restore tasks, reminders and recurrence; reassign | ✓ | ✓ | – |
| Be an assignee | ✓ | ✓ | – |
| Project Ideas (read and write) | ✓ | – (hidden; 403) | – |
| Invite members, change roles, disable accounts | ✓ | – | – |
| Workspace settings (category names, sweep), data export, job status | ✓ | – | – |
| Own profile, devices, notification settings, sessions | ✓ | ✓ | ✓ |
| Integrations (future) | ✓ | – | – |

- **Enforced in the service layer, not just the UI.**
  - Every service method calls `can(principal, action, resource)`.
  - An assignee must be an active owner or editor.
  - A table-driven test covers **every endpoint × every role**, plus anonymous access.
- **Single implicit workspace.** v1 has one workspace (yours) and no multi-tenancy. More users only need more `users` rows.
- **Extensions later:**
  - Per-category grants, or a per-idea "shared" toggle, would each be one table or column plus a policy change.
  - The principal abstraction (`{userId, role, via: 'session' | 'token'}`) is ready for personal API tokens.

### Dev and test login
`/auth/dev-login?as=owner|editor` exists **only** when `APP_ENV` is `development` or `test`. CI builds the production handler and asserts the route returns 404. This lets you and E2E tests act as Simran without a second Google account.

### iPhone Home Screen app sign-in (important quirk)
- **The problem:** iOS gives each Home Screen web app its own cookie jar, separate from Safari. OAuth navigation from the installed app can finish in a Safari sheet whose cookie never reaches the app.
- **Mitigation 1 — sign in first:** sign in in Safari first, then use Add to Home Screen. Recent iOS versions reportedly copy the site's cookies into the new app. Long sessions mean you rarely sign in again.
- **Mitigation 2 — one-time code:**
  1. On any signed-in device, go to Settings → Devices → "Sign in another device".
  2. It shows a 10-character code: about 50 bits of entropy, valid for 10 minutes, single-use, stored hashed.
  3. Enter the code in the installed app's sign-in screen, which calls `POST /auth/code`.
- **When to test:** on your iPhone as soon as the app is deployed (Phase 8).

---

## F. Notification architecture

### Mechanisms evaluated

| Mechanism | When it works | Verdict |
|---|---|---|
| In-page `Notification` + JS timers | Only while a tab is open and not suspended. Mobile browsers suspend background tabs; iOS Safari tabs don't support notifications at all. | ✗ |
| Notification Triggers (scheduled local notifications) | Abandoned Chromium experiment; never shipped. | ✗ |
| Periodic Background Sync | Chromium + installed PWA only; the browser picks the frequency (hours). | ✗ |
| **Web Push** (Push API + service worker + VAPID) | The server sends at the right minute; the browser's push service wakes the service worker even with no tab open. | ✅ |
| Email / Telegram / SMS | Always. | Future channels behind the same `NotificationChannel` port. |

### What Web Push can and can't do

| Platform | Needs | Tab/app closed | Browser fully quit |
|---|---|---|---|
| Desktop Chrome / Edge / Firefox | Permission | ✓ while the browser is running, even with no app tab open (on macOS the browser can run with no windows; Chrome can keep running in the background) | ✗ Queued by the push service and delivered on the next launch (within TTL) |
| macOS Safari 16+ (Ventura+) | Permission (from a click) | ✓ | ✓ Delivered by the OS even when Safari isn't running |
| Android Chrome / Firefox | Permission | ✓ | ✓ The OS wakes the browser. Aggressive battery savers can delay delivery. |
| iPhone/iPad, **Safari tab** | — | ✗ Not supported in tabs | ✗ |
| iPhone/iPad **Home Screen app** (iOS 16.4+) | Add to Home Screen, then permission from a tap inside the app | ✓ | ✓ Delivered via APNs even when the app isn't running |

**So:** your phone is the reliable device. Laptops notify whenever the browser is running, even with the app's tab closed.

### Flow
1. **Subscribe:**
   - Settings → Devices → **"Enable notifications on this device"** (a tap is required).
   - `Notification.requestPermission()`, then `pushManager.subscribe({userVisibleOnly: true, applicationServerKey})`.
   - The browser POSTs its endpoint, keys and a device label.
2. **Compute the time:** saving a reminder makes the server compute `fire_at` (UTC) from the floating date and time in the **recipient's** time zone.
3. **Dispatch:**
   - The scheduler runs every minute on Netlify (every 30 s locally) and claims due reminders with a conditional UPDATE.
   - It sends an encrypted push to **each** of the recipient's devices with these headers:
     - `TTL: 21600` (6 h);
     - `Urgency: high`;
     - `Topic` = the reminder ID, so a queued duplicate is replaced rather than stacked.
4. **Payload:** uses the **Declarative Web Push** format (Safari 18.4+ on iOS/iPadOS 18.4 and macOS 15.5). Apple devices display it even if the service worker was evicted; other browsers' service workers parse the same JSON:
   `{"web_push":8030,"notification":{"title":"Submit GST documents","body":"Due today · 30m · P1","navigate":"https://todo.utkarsh2102.org/tasks/<id>","tag":"reminder-<id>"}}`
5. **Service worker:** `push` calls `showNotification`. Its tag is the reminder ID, so repeats replace rather than stack. `notificationclick` focuses or opens `/tasks/:id`.
6. **Results:**
   - 2xx: `last_success_at`, and the reminder is marked `sent_at`.
   - 404/410: the subscription is deleted.
   - Other errors: `failure_count++`, with up to 5 attempts and backoff.

### Reminder model
- **Separate from the due date.** A task has 0..1 due date and 0..n reminders, stored in their own table.
- **Kinds:**
  - *Absolute:* e.g. "30 Sep at 09:00".
  - *Relative:* e.g. "on the due date at 09:00", or "1 day before at 18:00".
  - Relative reminders move automatically when the due date changes, and they are the ones copied to future recurring instances.
- **Cadence you control:**
  - `default_reminder_time` (09:00) plus presets in the editor: "On due date 9:00", "1 day before 9:00", "Custom…".
  - Later: automatic default reminders for any task with a due date.
- **Recipient:** the **assignee at send time**; unassigned tasks go to the owner. Reassigning a task to Simran sends the next reminders to Simran's devices. Watchers are a later feature.
- **Recomputation:**
  - `fire_at` is recomputed when the reminder is edited, the due date or assignee changes, the recipient changes time zone, or the task is reopened.
  - If the instant changes, the reminder re-arms (`sent_at` is cleared).
- **Guards:**
  - Completed or deleted tasks never notify.
  - A reminder more than 6 h late (e.g. after an outage) is marked `expired` instead of sent.
  - Scheduler health is monitored (see K).
- **Privacy:**
  - A per-user setting, "Hide task titles in notifications", shows "Reminder: 1 task due" instead of the title. Useful for Canonical/Freexian items on a lock screen.
  - Push payloads are end-to-end encrypted (RFC 8291), so Google, Mozilla and Apple can't read titles either way.
- **In-app:** overdue dates are red, and the 🔔 icon marks tasks with reminders. There is no separate notification inbox in v1.

### Limitations to accept
- **Timing:** about ±1 minute (cron granularity plus function start-up).
- **Delivery:** push services are best-effort. Usually delivery takes seconds, but it isn't guaranteed.
- **Suppression:** Do-Not-Disturb and Focus modes hide banners.
- **Permission:**
  - A denied permission is sticky: you must reset it in the browser's site settings.
  - Corporate-managed browsers may block notifications.
- **iOS:** needs the Home Screen app and a tap to enable; see E for sign-in.
- **Subscriptions:** they can silently expire. The **"Send test"** button and the device list (last success, last failure) make this visible.
- **Future polish:** notification actions such as Done or Snooze 1h don't work on iOS.

---

## G. Recurrence architecture

### Model: store the rule once; create one instance at a time; keep completed instances as history
- **Why not pre-generate future tasks?** The rows would be unbounded, "edit all future" would mean mass updates, and queues would clutter.
- **Why not one task that rolls its date forward (Todoist)?** It loses per-occurrence history and conflicts with "completed stays visible, then archives".
- **What this plan does:**
  - The rule lives in `task_series`, and **at most one open instance** exists per series.
  - Completing or skipping it creates the **next** instance.
  - Completed instances are ordinary tasks that follow the normal visible → archived path.
  - Rows therefore equal the occurrences you actually reached (4 a year for quarterly GST), and that *is* your history.

### Rule format
This is `rule_json`, validated by a shared Zod schema.

```ts
type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
type Rule =
  | { freq: 'daily';   interval: number }
  | { freq: 'weekly';  interval: number; weekdays: Weekday[] }
  | { freq: 'monthly'; interval: number; monthDay: number }            // 1..31, or -1 = last day
  | { freq: 'monthly'; interval: number; nthWeekday: { n: 1 | 2 | 3 | 4 | -1; weekday: Weekday } }
  | { freq: 'yearly';  interval: number; month: number; monthDay: number };
// Presets: Daily · Weekly on <due weekday> · Monthly on day <d> · Quarterly = monthly ×3 on day <d>
//          · Yearly on <d Mon> · Custom (interval, weekdays, day/nth weekday, end, repeat-from)
```

### Engine
The engine is **pure date arithmetic** in `packages/shared/src/recurrence/engine.ts`. There are no time zones, so client previews and server generation match exactly.
- **`fixed` mode:** `nextOccurrence(series, after)` = the first rule date strictly after `after`, and on or after `anchor_date`.
  - Periods are counted from the anchor: every `interval` months, weeks, and so on.
  - **`after` is the instance's `occurrence_date`, not its (possibly postponed) due date**, so pushing one GST filing from 10 Oct to 15 Oct doesn't shift the schedule.
- **`after_completion` mode:** next = completion date (local) + interval. For example, "every 2 weeks after I finish it".
- **Month-end dates clamp:** 31 → 30/28/29, and 29 Feb → 28 Feb in non-leap years. This is documented; it's what you want for bills, unlike RFC 5545, which skips such months.
- **Missed occurrences:** fixed-schedule occurrences are **never silently skipped**. Completing Q3 late still creates Q4, which may already be overdue. Use **Skip** for things you don't want to catch up on.
- **Ending:** `until_date` and `max_count` end the series. When no next date exists, the series gets `ended_at`.
- **Preview:** the recurrence editor shows the next 3 dates, e.g. "10 Jan 2027 · 10 Apr 2027 · 10 Jul 2027".
- **Export:** a best-effort conversion to RFC 5545 RRULE can be added later for Google Calendar.

### Instance lifecycle
All of these run in one transaction, together with `activity_log`.

| Action | Effect |
|---|---|
| Set "Repeat" on a task | Creates `task_series` with anchor = due date. If there's no due date, the anchor is the next matching date from today, and it's set as the due date. The task becomes instance #1 (`series_id`, `occurrence_date`). |
| Complete / Skip | Mark the instance done or skipped; compute the next date. `INSERT` the next instance, copying fields forward (title, description, category, priority, assignee, duration, links, due time, **relative** reminders), with `ON CONFLICT (series_id, occurrence_date) DO NOTHING`. **Double-clicks or two devices can never create two.** |
| Uncomplete (a mistake) | Reopen the instance. If its successor is untouched (`version = 1` and open), delete it; otherwise keep it and show "Next occurrence already exists". |
| Edit fields on the open instance | Carries forward (copy-forward). There is no separate template to keep in sync, which is Todoist-like behaviour. |
| Change the rule | Updates the series; takes effect when the next instance is generated. |
| Stop repeating | `ended_at` is set; the current task becomes a plain one-off. |
| Delete an open instance | Asks: **Skip this occurrence**, or **Delete and stop repeating**. |

- **Reminders on recurring tasks:** absolute reminders apply to the current occurrence only, and the UI says so. Relative reminders repeat.

### Worked example: quarterly GST
```
Task "File GST documents" · Admin · P1 · due 2026-10-10 · 60m · Repeat: Quarterly on day 10
task_series.rule = {freq:'monthly', interval:3, monthDay:10}, mode 'fixed', anchor 2026-10-10
#1 occurrence 2026-10-10 → completed 8 Oct         → creates #2 (2027-01-10)
#2 occurrence 2027-01-10 → completed 15 Jan (late) → creates #3 (2027-04-10)
reminder "3 days before at 09:00" is copied to each new instance
```

---

## H. Autosave architecture

### Client engine
This is `apps/web/src/lib/autosave.ts`, shared by the task detail view and Ideas.
- **State per open entity:** the server version and values, pending changes (with the base values they were made against), and a status.
- **When it saves:**
  - Discrete fields (checkbox, priority, dates, assignee, duration): **immediately**.
  - Text fields (title, description, idea body): **1.5 s after the last keystroke**, and at least every **20 s** during continuous typing. That's inside your 30–60 s requirement with margin.
  - **Flush now** on:
    - blur;
    - route change;
    - `visibilitychange → hidden`, the reliable "switched apps / locked phone" signal on mobile;
    - `pagehide`, sent with `fetch(…, {keepalive: true})`, which allows bodies up to 64 KB. Larger pending text relies on the crash buffer below.
- **Requests:**
  - One request in flight per entity; newer edits merge into the next one.
  - Retries back off exponentially (1 s → 60 s) on network or 5xx errors, with the status "Offline — will retry".
  - A `beforeunload` warning appears only when unsent changes can't be flushed.
- **Crash buffer (not the source of truth):**
  - Unsaved changes are mirrored to `localStorage` under `draft:<type>:<id>` (base version + fields) and cleared when a save succeeds.
  - On reopen: if the draft matches the server version, it's re-applied and saved; otherwise the conflict flow runs.
  - Every storage access is wrapped in try/catch; the app works without storage.

### Server (the source of truth)
- **Check before write:** `PATCH` does the field-level check described in D, and the `version` goes up on every save. A 409 carries the current state.
- **Ideas history:** Ideas get **revision snapshots**:
  - at most one every 10 minutes while you're editing;
  - always **before an overwrite or a restore**.
  - The History panel lists them, with Restore.

### Multi-device conflicts
- **Discrete task fields:** your latest explicit action wins automatically; it's re-sent against the new version. A toast says, for example, "Due date was also changed on another device".
- **Text fields** (task title and description, idea title and body):
  - A banner says "Edited on another device at 10:42".
  - Choices: **Keep theirs**, **Overwrite with mine**, or **Save mine as a copy**.
  - Nothing is lost silently: the server snapshots the current version before any overwrite.
- **Freshness:**
  - Refetch on window focus and tab visibility, and every 60 s while visible.
  - An open editor with no local changes silently adopts a newer server version, with the notice "Updated from another device".
  - So "write on the phone, refresh, come back" always shows the saved server copy.

### Why not just save every 30–60 s?
A phone can freeze or kill a background tab without warning, so a pure timer can lose up to a minute of typing. Saving 1.5 s after each pause, plus a flush whenever the app is hidden, closes that gap. It costs one write per pause, not per keystroke, which is trivial for Turso's 10M writes a month.

---

## I. Future integration architecture

### Ports
These interfaces live in `apps/api/src/ports/`; core depends only on them.
```ts
interface NotificationChannel { kind: 'webpush' | 'email'; send(to: UserId, n: Notice): Promise<DeliveryResult> }
interface CalendarProvider {
  freeBusy(acct: IntegrationAccount, range: Interval, calendarIds: string[]): Promise<Interval[]>;
  upsertEvent(acct: IntegrationAccount, e: CalendarEventInput & { taskId: string }): Promise<ExternalRef>;
  getEvent(acct: IntegrationAccount, ref: ExternalRef): Promise<CalendarEvent | null>;
  deleteEvent(acct: IntegrationAccount, ref: ExternalRef): Promise<void>;
}
interface TaskSyncProvider {               // Google Tasks
  listChanges(acct: IntegrationAccount, cursor?: string): Promise<{ items: ExternalTask[]; cursor: string }>;
  upsert(acct: IntegrationAccount, t: TaskSnapshot, ref?: ExternalRef): Promise<ExternalRef>;
}
interface Importer<Opts> {                 // Todoist (one-time)
  preview(opts: Opts): Promise<ImportPlan>;           // dry run: what would be created, how it maps
  commit(plan: ImportPlan): Promise<ImportReport>;    // idempotent via external_refs
}
interface NotesExporter { export(items: Idea[] | Task[]): Promise<ExportResult> }   // Obsidian
interface LLMProvider { generate(req: LlmRequest): Promise<LlmResponse> }           // Claude, OpenRouter, …
```

### How a provider plugs in without touching core
1. Core already writes every change to `activity_log` (the outbox) in the same transaction as the change.
2. A new migration adds `integration_accounts`, `external_refs` and `integration_cursors`.
3. The adapter in `adapters/<provider>/` implements the port.
4. A sync job registered in `runDueJobs`:
   - reads `activity_log` after its cursor;
   - calls the adapter;
   - records `external_refs`;
   - advances the cursor.
   Every step is idempotent, so retries are safe.
5. Settings → Integrations (Owner) gains a Connect button (OAuth) and a status line.

The `tasks` table, core services and existing screens don't change.

| Integration | Direction | Port | Trigger | Notes |
|---|---|---|---|---|
| Google Calendar | task → event; read free/busy | `CalendarProvider` | "Schedule" action + outbox | See J. |
| Google Tasks | import first, optional two-way later | `TaskSyncProvider` | scheduled poll (`updatedMin`) | Scope `…/auth/tasks`. Google Tasks keeps only a due *date*. Lists ↔ categories. |
| Google Docs | links now, content later | `DocsProvider` | on demand | v1 links already hold Docs URLs. Later: `drive.file` (non-sensitive) + Google Picker to read chosen docs; avoid `drive.readonly` (restricted). |
| Todoist | one-time import | `Importer` | CLI `pnpm import:todoist --dry-run` | See below. |
| Obsidian | export ideas (optionally tasks) | `NotesExporter` | on demand | Markdown + YAML frontmatter (`id`, `created`, `updated`) as a zip or to a git-synced vault. Tasks can export in Obsidian Tasks syntax. Later: a small Obsidian plugin using an API token. |
| AI assistant | read + propose writes | `LLMProvider` + tool layer | chat UI / MCP | See below. |

### Todoist import
- **Access:** Todoist's unified **API v1** (REST v2 and Sync v9 are deprecated), with your personal API token. The token is used once and not stored.
- **Mapping file:**
  - Projects → categories.
  - Priorities: Todoist's API numbers are inverted (API 4 = UI P1).
  - Dates and datetimes, and recurrence strings: common patterns become rules; anything else becomes a note and is flagged.
  - Duration.
  - Labels and comments are appended to the description.
- **Order of operations:** a dry-run report comes first. Re-running is safe because of `external_refs(provider='todoist')`.

### AI (future)
- **Where it lives:** `apps/api/src/ai/`, outside core.
- **Planning context:** built from core queries — priority, due date, duration, assignee, category, recurrence, recent completions (`activity_log`) — and, once connected, calendar free/busy.
- **Deterministic first:** "overdue", "≤ 20 min" and "P0/P1 needing attention" are plain queries. The model adds judgement for "what should I focus on today?" or "fill 3 hours tomorrow afternoon".
- **Tools = the same service calls:** list, get, create, update and complete tasks; find free slots; create a calendar block.
  - Their JSON Schemas are generated from the shared Zod schemas.
  - **Writes are proposals you confirm.**
- **Providers:** behind `LLMProvider` — the Anthropic SDK for Claude, and an OpenAI-compatible client for OpenRouter. Model IDs live in config; check the current Claude API docs at implementation time.
- **Claude Code / OpenCode:** `apps/mcp` exposes the same tools as an MCP server, authenticated with a personal API token (`api_tokens`).
- **v1 adds no AI dependency.** It only has to get the foundations right: the service layer, typed schemas, durations and history.

---

## J. Google Calendar integration (future; not in v1)

- **APIs:** Google Calendar API v3.
  - `freebusy.query` for busy intervals.
  - `calendars.insert` to create a dedicated "Utkarsh's To-Do" calendar.
  - `events.insert`, `get`, `patch` and `delete`.
  - Optionally `events.list` with a `syncToken`, to notice changes you make in Google Calendar.
- **Scopes (least privilege):**
  - `https://www.googleapis.com/auth/calendar.app.created` (*sensitive*): make secondary calendars and manage events only on calendars the app created. All task blocks live there — visible and editable in Google Calendar, colour-toggleable — and the app can never touch your other events.
  - `https://www.googleapis.com/auth/calendar.freebusy` (*non-sensitive*): read the availability of your calendars, without event details.
  - If you'd rather have blocks on your primary calendar, use `calendar.events.owned` (sensitive) instead of `app.created`.
  - Login keeps only `openid email profile`.
- **Credentials and config:**
  - Enable the Calendar API in the same Google Cloud project.
  - Add the redirect `https://todo.utkarsh2102.org/integrations/google/callback`, and add the scopes to the consent screen.
  - **Keep the app "In production".** In Testing, refresh tokens expire after 7 days.
  - Sensitive scopes on an unverified app show an "unverified app" warning, which is fine for personal use (unverified apps are capped at 100 users).
  - New secret: `DATA_ENCRYPTION_KEY` (32 random bytes).
- **Separate from login — yes:**
  - *Login:* OIDC for every member, basic scopes, no Google tokens stored.
  - *Calendar:* an Owner-only **"Connect Google Calendar"** flow using incremental authorization (`access_type=offline`, `prompt=consent`, `include_granted_scopes=true`).
  - The calendar may use a different Google account from the one you sign in with. Disconnecting it doesn't sign you out, and Simran signing in never grants calendar access.
  - The same OAuth client is fine, with a separate flow, callback, state and storage.
- **Tokens:**
  - The refresh token is **encrypted at rest** (AES-256-GCM, key from env) in `integration_accounts` and never sent to the browser or written to logs.
  - The access token is cached with its expiry and refreshed about 5 min early by the Google auth library.
  - An `invalid_grant` error sets `needs_reauth` and shows a banner.
  - **Disconnect** revokes the grant at Google and deletes the tokens.
  - Refresh tokens also lapse after about 6 months unused.
- **GitHub Actions — not at runtime:**
  - Actions only deploys code.
  - The client secret and encryption key live in Netlify env vars; user tokens live only in the DB, encrypted.
  - Sync runs in the Netlify scheduled function. Actions cron is too unreliable, and using it would mean exporting tokens.
- **Mapping tasks to events:**
  - An `external_refs` row per task instance: provider `google_calendar`, external ID = event ID, container = calendar ID, plus the etag.
  - Each event carries:
    - `extendedProperties.private.utodoTaskId = <task id>`;
    - `source = {title: "Utkarsh's To-Do", url: <task URL>}`;
    - summary = the task title;
    - description = a link back plus the first lines of the task description.
  - Recurring tasks get **one event per instance**; recurrence rules aren't synced.
- **Duplicate prevention (layered):**
  1. A unique `external_refs(provider, account, entity)`.
  2. A **deterministic event ID** from the task UUID: `ut` + 32 hex characters, valid base32hex. A retried insert collides instead of duplicating. Google doesn't guarantee duplicate detection at creation, hence the other layers.
  3. Before inserting, look up `privateExtendedProperty=utodoTaskId=<id>`.
  4. Outbox jobs claim work and are idempotent.
- **Your edits win:**
  - Events are created once.
  - If you move an event in Google Calendar, the app records the new time (etag check) instead of moving it back.
  - If the due date later changes, it asks "Move the calendar block?".
  - If you delete the event, the ref becomes `user_deleted` and the event is never recreated.
- **Finding a slot:**
  - Duration = the task's duration, or **30 min** if none.
  - Search working hours (a setting, e.g. Mon–Fri 10:00–18:00) from max(now, due − N days) up to the due date, using free/busy with 10-min buffers.
  - Offer the top 3 slots to confirm. If none fits, offer the nearest slot after the due date, flagged. The AI may later choose automatically.
- **Caveat:** a Canonical Google Workspace calendar may be blocked by admin policy for unverified apps; a personal account is unaffected. Test this first when this phase starts.

---

## K. Deployment architecture

### Local (now)
- **Prerequisites:** this machine has no Node yet. Install Node 24 LTS (e.g. fnm/nvm, or `snap install node --classic --channel=24`) and pnpm.
- **`pnpm dev`** runs:
  - Vite on port 5173;
  - Hono on Node (`apps/api/src/node.ts`) on port 8787, with Vite proxying `/api` and `/auth` so cookies are same-origin;
  - a SQLite database at `./.data/todist.db`;
  - the scheduler as an in-process 30 s interval.
- **Sign-in:** Google login via the localhost redirect, or the dev-only "Sign in as Owner/Editor".
- **Push:** desktop push works on `localhost`, which counts as a secure context. Testing on phones needs the deployed HTTPS site.
- **Daily use before deploying:** until Phase 8 you can use it from `pnpm start` (production build). When you deploy, seed Turso from the local SQLite file — the Turso CLI can create a database from a file or dump — so nothing is lost.

### Production: Netlify + Turso
- **Netlify site:**
  - A new site, separate from utkarsh2102.org's site, with custom domain `todo.utkarsh2102.org` and automatic HTTPS.
  - **Netlify's own Git builds are disabled**; GitHub Actions is the only deployer.
- **Functions:**
  - `netlify/functions/api.mts`: `export default (req: Request) => app.fetch(req)`, with `config.path = ['/api/*', '/auth/*']`.
  - `netlify/functions/scheduler.mts`: `config.schedule = '* * * * *'`, calling `runDueJobs(new Date())`.
  - Scheduled functions run only on the published deploy, have a 30 s limit, and use capped batches.
- **`netlify.toml`:**
  - publish directory `apps/web/dist`; the functions directory;
  - SPA fallback `/* → /index.html 200`. Verify that `/api/*` and `/auth/*` reach the function first.
  - security headers, `X-Robots-Tag: noindex`;
  - `Cache-Control: no-cache` for `index.html` and `sw.js`, and immutable caching for hashed assets.
- **Turso:**
  - Database `todist`, created in the AWS region closest to your Netlify Functions region.
  - Tokens: one read-write token for the app and migrations, one read-only token for backups.
  - Functions use the HTTP-only libSQL client, so no native modules go into the bundle.

### GitHub Actions workflows (`.github/workflows/`)
- **`ci.yml`** (every push and PR):
  1. `pnpm install --frozen-lockfile`
  2. typecheck
  3. lint
  4. unit + integration tests
  5. build
  6. Playwright E2E (desktop + mobile viewports)
  7. gitleaks
- **`deploy.yml`** (push to `main`, or manual):
  1. Runs only after CI passes (`needs`), in environment `production`, with `concurrency: production`.
  2. `pnpm db:migrate` against Turso. Migrations only add things, so the old code keeps working with the new schema.
  3. `netlify deploy --prod` with the prebuilt assets and functions.
  4. Smoke test: `GET /api/health` returns 200 and the deployed commit SHA.
  5. **Rollback:** re-publish the previous deploy (one click, or the CLI/API). It's safe because migrations are backward-compatible.
- **`backup.yml`** (nightly, at an off-peak minute such as 02:17 UTC):
  1. `scripts/backup.ts` uses the libSQL client and the read-only token to copy the schema and every table into a local SQLite file.
  2. Verify it: open it with `sqlite3`, run `PRAGMA integrity_check`, and check row counts.
  3. gzip it and encrypt it with your **age public key**.
  4. Upload it as an artifact with 90-day retention.
  - The private key stays offline with you.
  - Restore steps are in `docs/runbook.md`.
- **Repo settings:** make `main` protected, with the CI checks required, and add Dependabot for npm and actions.

### Secrets and configuration

| Name | Lives in | Used by |
|---|---|---|
| `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | GitHub environment `production` | deploy job |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (read-write) | GitHub `production` (migrations) + Netlify env (runtime) | migrate, API, scheduler |
| `TURSO_BACKUP_TOKEN` (read-only) | GitHub `production` | backup job |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Netlify env | login |
| `APP_SECRET` (32+ random bytes; OAuth-transaction cookie encryption) | Netlify env | auth |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`) | Netlify env | push (generated once; changing them invalidates all subscriptions) |
| `OWNER_EMAIL`, `APP_ORIGIN`, `APP_ENV=production` | Netlify env | config |
| `HEARTBEAT_URL` (optional, healthchecks.io) | Netlify env | scheduler dead-man's switch |
| `BACKUP_AGE_RECIPIENT` (public key) | GitHub variable | backup job |
| `DATA_ENCRYPTION_KEY` (future) | Netlify env | integrations |

- **Local:** secrets go in `.env.local` (gitignored); `.env.example` documents every variable.
- **Runtime secrets** are set once in Netlify and marked as secret. They're never piped through Actions on each deploy.

### Monitoring
- **Scheduler heartbeat:** the scheduler pings a free **healthchecks.io** check after each successful run. If reminders stop running for about 10 minutes, you get an email.
- **Backups:** the backup job pings a second check.
- **Errors:** they show up in the Netlify function logs.
- **In-app:** Settings → System shows the last reminder run, the last sweep and the last backup.

### Cost and Netlify credits
- **Expected monthly cost: $0.** Turso's free tier, Google OAuth and healthchecks.io are all free.
- **Netlify, legacy plan** (account created before 4 Sep 2025): the ~43k scheduler invocations a month plus API traffic fit within the legacy free limits.
- **Netlify, credit-based plan:**
  - 300 credits a month, **shared with utkarsh2102.org**.
  - A production deploy costs 15 credits.
  - The scheduler costs an estimated 30–40 credits a month.
  - **Running out pauses all your sites.**
- **Mitigations:**
  - Deploy only from `main`.
  - Batch deploys during heavy development.
  - Check usage in the first week.
  - Fall back to a 2-minute schedule if needed.
  - Or give the app its own Netlify team.

### A VPS later
The Hono app already runs as a Node server with an in-process scheduler and a local libSQL file. Moving to a VPS means adding a Dockerfile and Caddy; the data exports from Turso as a SQLite file.

---

## L. Security model

| Area | Controls |
|---|---|
| Public vs private | Everything except `/auth/*`, `/api/health` and static assets needs a session. The static bundle contains no data. `noindex` header + `robots.txt` disallow. |
| Authentication | Google OIDC code flow + PKCE + state + nonce. Full ID-token verification. `email_verified` required. Identity bound to Google `sub`. Only invited emails or `OWNER_EMAIL` get in. `returnTo` limited to same-origin paths. Dev login absent in production (tested). |
| Sessions | 256-bit random tokens; only hashes stored. `__Host-` cookie with HttpOnly, Secure and SameSite=Lax. Sliding + absolute expiry. Rotated at login. Revocable per device; revoked in full when a member is disabled. |
| Authorization | Central `can()` checked inside services. Ideas are Owner-only. Assignee must be an active owner/editor. Table-driven endpoint × role tests. |
| CSRF | SameSite=Lax. Custom middleware on every non-GET: `Origin` must equal `APP_ORIGIN` and `Content-Type` must be `application/json`. No CORS (same origin only). OAuth state/PKCE protects login. |
| XSS / Markdown | React escaping. `react-markdown` + `remark-gfm` with **no raw HTML**. URLs limited to `http`, `https` and `mailto`. External links get `rel="noopener noreferrer nofollow"`. Lint bans `dangerouslySetInnerHTML`. **CSP:** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`. Plus HSTS, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`. |
| Input | Strict Zod objects, so no mass assignment. Size limits: title 300, description 50 KB, idea body 500 KB, 20 links, 1 MB request bodies. UUID params validated. |
| Rate limiting | Netlify function rate-limit rules on `/auth/*` and `/api/*` where your plan supports them. Sign-in codes: ~50-bit entropy, 10 min, single use, hashed. The autosave client throttles itself. |
| Secrets | Never in the repo: gitleaks in CI, `.env*` ignored. Runtime secrets only in Netlify env; deploy credentials only in a protected GitHub environment. Least privilege (read-only backup token). Rotation steps in `docs/runbook.md`. |
| OAuth tokens (future) | AES-256-GCM with the key outside the DB. Never sent to the browser or logged. Minimal scopes; revoked on disconnect. |
| Database | Reachable only with the Turso token. No admin UI exposed. Encrypted off-site backups. Migrations reviewed in PRs. |
| Push | VAPID private key server-side only. Payloads end-to-end encrypted. Endpoints never logged in full. The device's subscription is removed on logout. |
| Supply chain | Frozen lockfile, few dependencies, Dependabot, GitHub Actions pinned to commit SHAs. |
| Logging | Structured logs without tokens, cookies or notification contents. Generic error messages to clients. |
| Data sensitivity | Simran sees all categories (your choice). Canonical/Freexian titles are stored on Netlify/Turso and may show on lock screens. Keep embargoed details out of titles, and use "hide titles in notifications". |

---

## M. Repository structure (`~/github/todoist`, private GitHub repo)

```
todoist/
├─ apps/
│  ├─ web/                              React SPA + PWA (Vite)
│  │  ├─ index.html · vite.config.ts
│  │  ├─ public/                        icons (incl. maskable), robots.txt
│  │  └─ src/
│  │     ├─ main.tsx · App.tsx · routes.tsx
│  │     ├─ features/board/             Board, Quadrant, QuickAdd, TaskCard
│  │     ├─ features/task/              TaskPanel, fields/, RecurrenceEditor, ReminderEditor, LinksEditor
│  │     ├─ features/completed/         CompletedList
│  │     ├─ features/ideas/             IdeaList, IdeaEditor, IdeaHistory
│  │     ├─ features/settings/          Profile, Devices, Members, System
│  │     ├─ lib/                        api.ts · autosave.ts · push.ts · dates.ts · markdown.tsx · queryClient.ts
│  │     ├─ sw.ts                       service worker: push, notificationclick, static precache
│  │     └─ styles/                     tokens.css (palette, light/dark) · base.css
│  └─ api/                              Hono app (runtime-agnostic)
│     ├─ src/
│     │  ├─ app.ts                      builds the Hono app (routes + middleware)
│     │  ├─ node.ts                     local/VPS entry: @hono/node-server + interval scheduler
│     │  ├─ config.ts                   Zod-validated env
│     │  ├─ http/                       routes/*.ts · middleware/ (session, origin, errors, headers)
│     │  ├─ core/                       tasks/ recurrence/ reminders/ archive/ ideas/ members/(policy.ts) activity/
│     │  ├─ ports/                      PushSender, Clock, IdentityProvider, (future) Calendar…, LLM…
│     │  ├─ adapters/                   webpush/ · google-oidc/ · (future) google-calendar/ todoist/ …
│     │  ├─ jobs/                       runDueJobs.ts + job registry
│     │  └─ db/                         schema.ts · client.ts · migrations/ (drizzle-kit)
│     └─ test/                          integration tests · fakes (FakeClock, FakePushSender, FakeIdP)
├─ packages/shared/src/                 zod schemas (API contract) · types · priority.ts · sort.ts
│                                       · recurrence/engine.ts · dates.ts (floating-date helpers)
├─ netlify/functions/                   api.mts · scheduler.mts
├─ netlify.toml
├─ e2e/                                 Playwright specs
├─ scripts/                             seed.ts · backup.ts · (future) import-todoist.ts
├─ docs/                                architecture.md · decisions/ (ADRs) · runbook.md · security.md
├─ .github/workflows/                   ci.yml · deploy.yml · backup.yml   (+ dependabot.yml)
├─ CLAUDE.md                            commands + guardrails (below)
├─ .env.example · .nvmrc · package.json · pnpm-workspace.yaml · tsconfig.base.json · eslint.config.js
```

### `CLAUDE.md` guardrails
- `pnpm verify` (typecheck, lint, test) must pass before a phase is considered done.
- `core/` never imports `adapters/`, HTTP code or SDKs.
- Every endpoint needs a Zod schema, a policy check and an authorization test.
- Migrations are generated by drizzle-kit, never edited after they've been applied, and only add things.
- No secrets in code; all config goes through `config.ts`.
- New dependencies need a one-line justification.
- Stay within v1 scope; integrations are ports only.

---

## N. Implementation phases

Each phase is one or a few PR-sized steps for Claude Code, finishing with green tests.

**Manual setup that's yours** (consoles aren't scriptable):
- the GitHub repo;
- the Google Cloud OAuth client;
- the Turso DB and tokens;
- the Netlify site, domain and env vars;
- VAPID keys (`npx web-push generate-vapid-keys`);
- an age keypair;
- healthchecks.io.

Each item gets a checklist in `docs/runbook.md`.

**Phase 8 can move earlier** (any time after Phase 2) if you want the app on your phone sooner.

| # | Phase | Scope | Done when |
|---|---|---|---|
| 0 | Bootstrap (local) | `git init`; pnpm workspace; strict TS; ESLint/Prettier with boundary rules; Vitest; `ci.yml`; `CLAUDE.md`; `.env.example`; ADR-001 (stack). | `pnpm dev` serves a hello page and `/api/health`. CI is green. |
| 1 | Data + shared domain | Drizzle schema and migrations: users, sessions, categories, tasks, activity_log, app_settings, job_runs. Later tables arrive in their phases as additive migrations: `task_series` + the series columns (7); `reminders`, `push_subscriptions`, `signin_codes` (9); `ideas`, `idea_revisions` (10). `packages/shared`: Zod schemas, priority, `sort.ts`, date helpers. Seed script. | Migrations apply to a fresh file and to in-memory DBs. The sort comparator's table-driven tests pass. |
| 2 | Auth + roles + shell | `openid-client` flow, sessions, owner bootstrap, invite activation, `policy.ts`, Origin check, secure headers, `/me`, members API, dev login. SPA shell: sign-in page, navigation, Settings → Members. | You can sign in locally with Google; a non-invited account is refused. The endpoint × role matrix tests pass. Dev login returns 404 in the production build. |
| 3 | Task service + API | `TaskService` (retry-safe create, PATCH with check-and-save, complete/uncomplete, delete/restore), activity log, `/board`, archived list. | Integration tests cover CRUD, merges and conflicts, and authorization. |
| 4 | Board UI + quick add | 2×2 grid, mobile tabs, QuickAdd (on-screen instantly, focus kept, highlight), TaskCard (bold title · due · duration · chip/stripe · initials), checkbox with Undo, completed group, `tokens.css` palette (light/dark). | Playwright: "Submit GST documents" + Enter appears and survives a reload; checking moves it to the bottom; unchecking restores it. Desktop and phone viewports both work. |
| 5 | Task detail + autosave + Markdown | Drawer/page with all fields; `autosave.ts` (debounce/maxWait, visibility and pagehide flush, keepalive, crash buffer, retry, conflict banner); safe Markdown renderer; links editor. | Editing then reloading immediately keeps the change. A two-browser conflict shows the banner with no loss. XSS payloads render as inert text. |
| 6 | Scheduler + weekly archive + Completed | `runDueJobs` + `job_runs`; local interval runner; `ArchiveService` (boundary-based, idempotent, lazy check in `/board`); Completed view (by week, filter, restore). | Fake-clock tests pass: the 5-day vs 12-day example, a missed-Friday catch-up on Saturday, and a double run doing nothing. |
| 7 | Recurrence | Shared engine + unit and fast-check property tests; `task_series` migration; complete/skip → next instance (one transaction, unique guard); uncomplete rollback; stop; delete prompt; RecurrenceEditor with presets and a 3-date preview. | The GST example works end-to-end. Month-end and leap-year tests pass. A concurrent-completion test produces exactly one successor. |
| 8 | Deploy: Netlify + Turso + backups | Turso DB and tokens; Netlify site + domain + env; `api.mts`/`scheduler.mts` wrappers; `netlify.toml` (routing, headers, caching); `deploy.yml` (migrate → deploy → smoke test); `backup.yml` (dump → verify → encrypt → artifact); heartbeat; runbook. | A push to `main` deploys automatically. Sign-in works at `todo.utkarsh2102.org` on laptop and phone. A backup artifact restores into a fresh DB. |
| 9 | Reminders + PWA + Web Push | Manifest/icons/SW (`injectManifest`); install guidance; VAPID config; subscription and test endpoints; Devices page; migrations for `reminders`, `push_subscriptions` and `signin_codes`; ReminderEditor (absolute and relative presets); `fire_at` computation and recomputation; dispatcher (claims, 6 h expiry, TTL/urgency/topic, 404/410 cleanup, retries); declarative payload; notification click; hide-titles setting; one-time sign-in code. | Unit tests pass for `fire_at` (time zones including DST zones) and for the dispatcher with FakePushSender. The **manual device matrix** passes (Verification). |
| 10 | Project Ideas | Owner-only policy; list + search; editor (split view on desktop, Edit/Preview on phone); reuse of `autosave.ts`; `idea_revisions` + History/Restore; conflict flow. | Playwright: phone-viewport typing then an immediate reload keeps the text. Two contexts show the conflict with no loss. The editor account sees no Ideas tab and gets a 403. |
| 11 | Hardening + v1 sign-off | CSP/header tests; rate limits; accessibility (axe scan, keyboard paths); empty, error and offline states; JSON export; Settings → System; runbook (deploy, rollback, restore, add member, rotate secrets); full acceptance run. | Every item in section O is checked. |

---

## Verification strategy

- **Unit tests (Vitest):**
  - the sort comparator (table of cases);
  - the recurrence engine: examples, plus properties such as next > after, clamping, count/until and idempotence;
  - `fire_at` time-zone math (Asia/Kolkata plus DST zones such as Europe/Berlin);
  - sweep boundary math;
  - PATCH merge logic;
  - the policy matrix.
- **Integration tests (in-memory libSQL, Hono `app.request()`):**
  - every endpoint × role;
  - optimistic-concurrency conflicts;
  - complete → next instance being atomic;
  - a duplicate-completion race;
  - reminder dispatch with a fake clock and a fake push sender (claims, expiry, 404/410 cleanup);
  - Markdown/XSS strings stored verbatim.
- **End-to-end tests (Playwright; desktop + iPhone/Android viewports; dev login):**
  - quick add + reload;
  - complete/uncomplete ordering;
  - autosave + immediate reload;
  - a two-context conflict;
  - Ideas hidden from the Editor;
  - an axe accessibility scan;
  - an offline banner under network emulation.
- **After each deploy:** the smoke test (health + SHA), the scheduler heartbeat seen in healthchecks.io, and the nightly backup artifact with its integrity check.
- **Manual device matrix (Phase 9 and sign-off):** each device must receive the "Send test" notification and a real reminder within about 1 minute, and tapping it must open the task.
  - desktop Chrome and Firefox, with the tab closed and the browser running;
  - macOS Safari, if available;
  - Android Chrome, with the browser closed;
  - the iPhone Home Screen app, with the app closed.

---

## O. V1 acceptance criteria

**Access & auth**
- [ ] Signed out, `todo.utkarsh2102.org` shows only the sign-in page, and `GET /api/v1/board` → 401.
- [ ] You can sign in with Google; an uninvited Google account is refused and sees no data.
- [ ] You invite Simran as Editor. Simran signs in and can create, edit, complete, delete and reassign tasks in all four categories.
- [ ] Simran sees no Project Ideas tab, and every ideas endpoint returns 403.
- [ ] A Viewer (test account) can read, but every write returns 403. Disabling a member ends their sessions immediately.

**Board & tasks**
- [ ] Desktop shows the 2×2 grid (Canonical top-left, Freexian top-right, Admin bottom-left, Aspirational bottom-right); a phone shows one category at a time with tabs.
- [ ] "Submit GST documents" + Enter creates a task instantly, clears and keeps focus, and it survives a reload.
- [ ] Cards show the **bold title | due date | duration**, the priority chip, and assignee initials only when the assignee isn't you.
- [ ] Opening a card shows every field (description, links, priority, due date and time, duration, assignee, reminders, repeat). Every edit autosaves; there's no Save button.
- [ ] P0–P4, Wish and none use the specified palette, with the label always visible.
- [ ] Ordering follows C.1 (automated test + a visual spot-check). Delete offers Undo.

**Completion & archive**
- [ ] Checking moves the task to the muted completed group at the bottom of its quadrant; unchecking returns it to its sorted place.
- [ ] The Friday sweep archives only tasks completed ≥7 days before it; 5-day-old completions stay. A missed Friday is caught up correctly. Nothing is ever hard-deleted.
- [ ] The Completed view shows archived tasks with completion timestamps; unchecking restores one.

**Recurrence**
- [ ] Presets (daily, weekly, monthly, quarterly, yearly) and Custom (interval, weekdays, day of month incl. last day, nth weekday, end date/count, repeat-from-completion) work, with a 3-date preview.
- [ ] Quarterly GST produces 10 Jan → 10 Apr → 10 Jul → 10 Oct. Only one open instance exists at a time, and past instances remain as history.
- [ ] Completing on two devices yields one next instance. Uncompleting removes an untouched successor. Skip and Stop repeating work.

**Reminders & notifications**
- [ ] A task can have several absolute and relative reminders; relative ones follow due-date changes.
- [ ] "Enable notifications" and "Send test" work on desktop Chrome, Android Chrome and the iPhone Home Screen app.
- [ ] Reminders arrive within about 1 minute on all of the assignee's enabled devices:
  - on the laptop with the tab closed (browser running);
  - on the phone with the app closed.
- [ ] After reassignment to Simran, reminders go only to Simran's devices. Completed and deleted tasks never notify. Tapping a notification opens the task.

**Project Ideas & autosave**
- [ ] Markdown renders headings, lists, task lists, tables, links and code. Raw HTML/`<script>` shows as text, and `javascript:` links aren't clickable.
- [ ] Typing on the phone then refreshing immediately keeps the text, and the laptop shows the same text.
- [ ] Editing the same idea on two devices never silently loses text: a conflict banner appears, and revisions can be restored.
- [ ] Closing the tab within 2 s of typing still saves the text, or restores the local draft on reopen.

**Platform & operations**
- [ ] Works on current desktop Chrome, Firefox and Safari, iPhone Safari (tab and installed), and Android Chrome, with no horizontal scrolling at 360 px.
- [ ] In the private GitHub repo, every push runs CI. A push to `main` deploys automatically, and a failing CI blocks deploy.
- [ ] HTTPS on `todo.utkarsh2102.org`, with the CSP, HSTS and nosniff headers verified.
- [ ] A nightly encrypted backup exists, and a restore drill into a fresh DB succeeded once.
- [ ] The heartbeat alert fired when the scheduler was deliberately disabled once.
- [ ] gitleaks is clean, `.env.example` is complete, and `docs/runbook.md` covers deploy, rollback, restore, adding a member and rotating secrets.
- [ ] Out-of-scope items are absent: no Calendar, Tasks, Docs, Todoist, Obsidian or AI code, no native apps, and no dashboards.

---

## P. Risks and design decisions

1. **iPhone notifications**
   - *Requirements:* the Home Screen app (iOS 16.4+) and a tap to enable. Home Screen apps don't share Safari's cookies.
   - *Mitigation:* sign in first, then install; use the one-time sign-in code. Test on your iPhone right after Phase 8.
2. **Desktop notifications**
   - *Limitation:* they need the browser running. Chrome and Firefox queue messages until the next launch; macOS Safari delivers even when closed.
   - *Mitigation:* documented; the phone is the dependable device.
3. **Timing and outages**
   - *Limitation:* reminders are precise to about 1 minute.
   - *Mitigation:* during outages longer than 6 h, reminders expire rather than arriving as a burst of stale notifications, and the heartbeat alert tells you.
4. **Netlify credits**
   - *Risk:* if your account is on a credit-based plan, credits are shared with your homepage, and running out pauses **all** your sites.
   - *Action:* check your plan type (Billing) before Phase 8; mitigations are in K.
5. **Latency**
   - *Limitation:* Functions and Turso sit in one AWS region (US East by default). From India, each API call takes roughly 200–300 ms.
   - *Mitigation:* the UI updates instantly for quick add, checkboxes and autosave. Co-locate the DB with the functions, and move both closer if your plan allows.
6. **Serverless constraints**
   - *Limitation:* no memory kept between requests, no timers, a 30 s scheduler limit, and DB transactions that must stay short.
   - *Mitigation:* the design is stateless and idempotent from day one: claims, a boundary-based sweep and unique constraints.
7. **Vendor risk**
   - *Risk:* depending on Turso and Netlify.
   - *Mitigation:* SQLite is portable, and Hono runs anywhere, so moving to a VPS is a deploy change, not a rewrite.
8. **Recurrence semantics (decided)**
   - Missed fixed-schedule occurrences are never skipped silently; there's a Skip button.
   - The next instance appears as soon as you complete the current one. A quarterly task therefore sits, sorted by its far-off date, in its queue. If that feels cluttered, add "show N days before due" later (small change).
   - Month-end dates clamp to the last day of the month.
9. **Unprioritized tasks** sort after P4 and before Wish List. This is a single constant.
10. **Time zones (decided)**
    - Due dates are floating: "2 Oct" means 2 Oct wherever you are.
    - Reminders and today/overdue use each person's profile time zone.
    - The weekly sweep uses your (Owner) time zone, Friday 06:00.
    - Update the profile time zone when travelling.
11. **Confidentiality**
    - Simran sees all categories, including work items and "pay the assistant" tasks.
    - Notifications can appear on lock screens, so use the hide-titles setting.
    - Check your employer's policy on keeping work task titles in personal SaaS.
12. **Google accounts**
    - Sign in with personal Google accounts. A Canonical Workspace account may be restricted by its admins, which matters more for Calendar later.
    - Invite the exact Google email; the binding then uses the stable `sub`.
13. **OAuth consent screen**
    - Publish it "In production" from the start.
    - Remember the 7-day refresh-token trap in Testing mode when Calendar arrives.
14. **Autosave is not live co-editing**
    - Simultaneous edits to the same text field produce a conflict prompt, not a live merge.
    - That's acceptable for two people, and revisions protect ideas.
15. **Browser storage**
    - It's only a crash buffer. If it's blocked, the app still works, but unsent edits can't survive a crash.
16. **Service worker updates**
    - Cache as little as possible: static assets only, never API responses.
    - After flushing autosave, show a "New version — Reload" prompt.
17. **Scope discipline**
    - These are post-v1 unless they fall out cheaply in Phase 11:
      - quick-add parsing;
      - Done/Snooze actions on notifications;
      - an app-icon badge count;
      - email reminders;
      - renaming categories;
      - a "show N days before due" option for recurring tasks;
      - diff views for conflicts.

---

## Sources
- WebKit: [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) · [Home Screen apps don't share storage with Safari (bug 181849)](https://bugs.webkit.org/show_bug.cgi?id=181849)
- [web.dev Push notifications FAQ](https://web.dev/push-notifications-faq/) · [Pushpad: notifications when the browser is closed](https://pushpad.xyz/blog/can-you-display-notifications-when-the-browser-is-closed) · [Safari declarative push on macOS 15.5](https://www.idownloadblog.com/2025/05/13/safari-mac-declarative-web-push-macos-15-5-support/) · [Google OAuth in iOS PWAs](https://intercom.help/progressier/en/articles/9519381-google-oauth2-is-not-working-in-my-pwa-on-ios-why)
- Google: [Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth) · [freebusy.query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query) · [events.insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) · [Docs API scopes](https://developers.google.com/workspace/docs/api/auth) · [OAuth 2.0 (Testing-mode refresh-token expiry)](https://developers.google.com/identity/protocols/oauth2)
- [Todoist API v1](https://developer.todoist.com/api/v1/)
- Netlify: [Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/) · [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) · [Hono on Netlify](https://hono.dev/docs/getting-started/netlify)
- [Turso free-tier limits (2026)](https://basekv.com/articles/turso-pricing-free-tier-limits-2026) · [Neon pricing](https://neon.com/pricing) · [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [GitHub Actions scheduled-workflow caveats](https://runhooks.app/blog/github-actions-scheduled-workflows-unreliable/) · [Node.js release schedule](https://endoflife.date/nodejs) · [web-push library](https://github.com/web-push-libs/web-push)
