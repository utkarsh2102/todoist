import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '@todist/shared';
import { seedDevData } from '../src/db/dev-seed';
import { activityLog, tasks, users } from '../src/db/schema';
import { createTestDb } from './helpers';

const OPTIONS = {
  ownerEmail: 'Owner@Example.test',
  editorEmail: 'editor@example.test',
  timezone: 'Asia/Kolkata',
  now: Date.UTC(2026, 8, 27, 12, 0, 0),
};

describe('seedDevData', () => {
  it('creates an owner, an editor and sample tasks in every category', async () => {
    const { db } = await createTestDb();

    await seedDevData(db, OPTIONS);

    const people = await db.select().from(users);
    expect(people.map((u) => [u.email, u.role, u.status]).sort()).toEqual([
      ['editor@example.test', 'editor', 'active'],
      ['owner@example.test', 'owner', 'active'],
    ]);
    const rows = await db.select().from(tasks);
    expect(new Set(rows.map((t) => t.categoryId))).toEqual(new Set(CATEGORY_IDS));
    expect(rows.some((t) => t.completedAt !== null && t.resolution === 'done')).toBe(true);
    expect(rows.find((t) => t.title === 'Submit GST documents')?.dueDate).toBe('2026-10-10');
    expect(await db.$count(activityLog)).toBe(rows.length);
  });

  it('is idempotent', async () => {
    const { db } = await createTestDb();

    await seedDevData(db, OPTIONS);
    const firstCount = await db.$count(tasks);
    await seedDevData(db, OPTIONS);

    expect(await db.$count(users)).toBe(2);
    expect(await db.$count(tasks)).toBe(firstCount);
  });
});
