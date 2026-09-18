import { asc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { newId } from '@todist/shared';
import { type Db, migrateDb } from '../src/db/client';
import { categories, sessions, tasks, users } from '../src/db/schema';
import { createTestDb, expectDbError } from './helpers';

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);

async function insertUser(db: Db, overrides: Partial<typeof users.$inferInsert> = {}) {
  const row = {
    id: newId(),
    email: `user-${Math.random().toString(36).slice(2)}@example.test`,
    name: 'Test User',
    role: 'owner' as const,
    status: 'active' as const,
    timezone: 'Asia/Kolkata',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
  await db.insert(users).values(row);
  return row;
}

function taskRow(createdBy: string, overrides: Partial<typeof tasks.$inferInsert> = {}) {
  return {
    id: newId(),
    categoryId: 'admin' as const,
    title: 'Submit GST documents',
    createdBy,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('migrations', () => {
  it('create the schema and seed the four categories in grid order', async () => {
    const { db } = await createTestDb();

    const rows = await db.select().from(categories).orderBy(asc(categories.position));

    expect(rows.map((c) => [c.position, c.id, c.name])).toEqual([
      [0, 'canonical', 'Canonical To-Do'],
      [1, 'freexian', 'Freexian To-Do'],
      [2, 'admin', 'Admin To-Do'],
      [3, 'aspirational', 'Aspirational To-Do'],
    ]);
  });

  it('are idempotent', async () => {
    const { db } = await createTestDb();
    await migrateDb(db);
    expect(await db.$count(categories)).toBe(4);
  });
});

describe('schema constraints', () => {
  let db: Db;
  let userId: string;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    userId = (await insertUser(db)).id;
  });

  it('accepts a minimal task and applies defaults', async () => {
    const row = taskRow(userId);
    await db.insert(tasks).values(row);

    const saved = await db.query.tasks.findFirst({ where: eq(tasks.id, row.id) });

    expect(saved).toMatchObject({
      title: 'Submit GST documents',
      descriptionMd: '',
      priority: null,
      linksJson: '[]',
      version: 1,
      completedAt: null,
      archivedAt: null,
    });
  });

  it.each([
    ['an empty title', { title: '' }, /tasks_title/],
    ['a title over 300 characters', { title: 'x'.repeat(301) }, /tasks_title/],
    ['an unknown priority', { priority: 'P9' as never }, /tasks_priority/],
    ['a malformed due date', { dueDate: '10/02/2026' }, /tasks_due_date/],
    ['a due time without a due date', { dueTime: '09:00' }, /tasks_due_time/],
    ['a zero duration', { durationMin: 0 }, /tasks_duration/],
    ['a resolution on an open task', { resolution: 'done' as const }, /tasks_resolution/],
    ['a completed task without a resolution', { completedAt: NOW }, /tasks_resolution/],
    ['archiving an open task', { archivedAt: NOW }, /tasks_archived_requires_completed/],
    ['links that are not a JSON array', { linksJson: '{"url":"x"}' }, /tasks_links_json/],
  ])('rejects %s', async (_label, overrides, constraint) => {
    await expectDbError(db.insert(tasks).values(taskRow(userId, overrides)), constraint);
  });

  it('enforces foreign keys', async () => {
    await expectDbError(
      db.insert(tasks).values(taskRow(userId, { categoryId: 'personal' as never })),
      /FOREIGN KEY/,
    );
    await expectDbError(
      db.insert(tasks).values(taskRow(userId, { assigneeId: newId() })),
      /FOREIGN KEY/,
    );
  });

  it('keeps user emails unique and lower-case', async () => {
    await insertUser(db, { email: 'simran@example.test', role: 'editor' });
    await expectDbError(insertUser(db, { email: 'simran@example.test' }), /UNIQUE/);
    await expectDbError(insertUser(db, { email: 'Upper@Example.test' }), /users_email_lowercase/);
  });

  it('rejects unknown roles and statuses', async () => {
    await expectDbError(insertUser(db, { role: 'admin' as never }), /users_role/);
    await expectDbError(insertUser(db, { status: 'pending' as never }), /users_status/);
  });

  it('deletes a user’s sessions with the user', async () => {
    await db.insert(sessions).values({
      id: 'hash',
      userId,
      createdAt: NOW,
      lastSeenAt: NOW,
      expiresAt: NOW + 1,
    });

    await db.delete(users).where(eq(users.id, userId));

    expect(await db.$count(sessions)).toBe(0);
  });
});
