import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { CATEGORY_IDS, PRIORITIES } from '@todist/shared';

// Data model: docs/plan-v1.md, section C. Conventions:
// - ids are UUIDv7 text; instants are integer UTC epoch milliseconds;
// - calendar dates are floating 'YYYY-MM-DD' text, times 'HH:MM';
// - every mutable row has `version` for optimistic concurrency; deletes are soft (`deleted_at`).
// Later phases add task_series (7), reminders/push_subscriptions/signin_codes (9), ideas (10).

const ROLES = ['owner', 'editor', 'viewer'] as const;
const USER_STATUSES = ['invited', 'active', 'disabled'] as const;
const RESOLUTIONS = ['done', 'skipped'] as const;

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));
const DATE_GLOB = sql.raw(`'[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`);
const TIME_GLOB = sql.raw(`'[0-2][0-9]:[0-5][0-9]'`);

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(), // lower-cased Google email: the invite key
    googleSub: text('google_sub').unique(), // Google's stable account id, bound at first sign-in
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    role: text('role', { enum: ROLES }).notNull(),
    status: text('status', { enum: USER_STATUSES }).notNull(),
    timezone: text('timezone').notNull(), // IANA zone, e.g. 'Asia/Kolkata'
    defaultReminderTime: text('default_reminder_time').notNull().default('09:00'),
    notifyHideContent: integer('notify_hide_content', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastLoginAt: integer('last_login_at'),
  },
  (t) => [
    check('users_role', sql`${t.role} IN (${inList(ROLES)})`),
    check('users_status', sql`${t.status} IN (${inList(USER_STATUSES)})`),
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
    check('users_reminder_time', sql`${t.defaultReminderTime} GLOB ${TIME_GLOB}`),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // SHA-256 of the session token; the token itself is never stored
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('sessions_user').on(t.userId), index('sessions_expires').on(t.expiresAt)],
);

export const categories = sqliteTable(
  'categories',
  {
    id: text('id', { enum: CATEGORY_IDS }).primaryKey(),
    name: text('name').notNull(),
    position: integer('position').notNull().unique(), // 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [check('categories_position', sql`${t.position} BETWEEN 0 AND 3`)],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id', { enum: CATEGORY_IDS })
      .notNull()
      .references(() => categories.id),
    title: text('title').notNull(),
    descriptionMd: text('description_md').notNull().default(''),
    priority: text('priority', { enum: PRIORITIES }), // NULL = no priority
    dueDate: text('due_date'),
    dueTime: text('due_time'),
    durationMin: integer('duration_min'),
    assigneeId: text('assignee_id').references(() => users.id), // NULL = unassigned (owner gets reminders)
    linksJson: text('links_json').notNull().default('[]'),
    completedAt: integer('completed_at'),
    completedBy: text('completed_by').references(() => users.id),
    resolution: text('resolution', { enum: RESOLUTIONS }),
    archivedAt: integer('archived_at'), // set by the weekly sweep
    deletedAt: integer('deleted_at'), // soft delete
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    index('tasks_board').on(t.categoryId, t.archivedAt, t.deletedAt),
    index('tasks_assignee').on(t.assigneeId),
    index('tasks_sweep')
      .on(t.completedAt)
      .where(sql`${t.archivedAt} IS NULL`),
    check('tasks_title', sql`length(${t.title}) BETWEEN 1 AND 300`),
    check('tasks_priority', sql`${t.priority} IS NULL OR ${t.priority} IN (${inList(PRIORITIES)})`),
    check('tasks_due_date', sql`${t.dueDate} IS NULL OR ${t.dueDate} GLOB ${DATE_GLOB}`),
    check(
      'tasks_due_time',
      sql`${t.dueTime} IS NULL OR (${t.dueDate} IS NOT NULL AND ${t.dueTime} GLOB ${TIME_GLOB})`,
    ),
    check('tasks_duration', sql`${t.durationMin} IS NULL OR ${t.durationMin} BETWEEN 1 AND 1440`),
    // Spell out IS NOT NULL: `NULL IN (…)` is NULL, and CHECK only rejects FALSE.
    check(
      'tasks_resolution',
      sql`(${t.completedAt} IS NULL AND ${t.resolution} IS NULL) OR (${t.completedAt} IS NOT NULL AND ${t.resolution} IS NOT NULL AND ${t.resolution} IN (${inList(RESOLUTIONS)}))`,
    ),
    check(
      'tasks_archived_requires_completed',
      sql`${t.archivedAt} IS NULL OR ${t.completedAt} IS NOT NULL`,
    ),
    check(
      'tasks_links_json',
      sql`json_valid(${t.linksJson}) AND json_type(${t.linksJson}) = 'array'`,
    ),
    check('tasks_version', sql`${t.version} >= 1`),
  ],
);

// Append-only log of every state change, written in the same transaction as the change.
// Serves as audit trail, completion history (future AI) and integration outbox (seq = cursor).
export const activityLog = sqliteTable(
  'activity_log',
  {
    seq: integer('seq').primaryKey({ autoIncrement: true }),
    occurredAt: integer('occurred_at').notNull(),
    actorId: text('actor_id').references(() => users.id), // NULL = system (scheduler)
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    type: text('type').notNull(), // e.g. 'task.created', 'task.completed'
    dataJson: text('data_json'),
  },
  (t) => [index('activity_entity').on(t.entityType, t.entityId, t.seq)],
);

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Bookkeeping for scheduled jobs (reminder dispatch, weekly archive sweep, housekeeping).
export const jobRuns = sqliteTable('job_runs', {
  name: text('name').primaryKey(),
  lastStartedAt: integer('last_started_at'),
  lastSuccessAt: integer('last_success_at'),
  lastBoundary: integer('last_boundary'),
  lastError: text('last_error'),
});
