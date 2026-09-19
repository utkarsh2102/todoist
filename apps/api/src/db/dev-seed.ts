import { eq } from 'drizzle-orm';
import {
  addDays,
  type CategoryId,
  newId,
  type PlainDate,
  type Priority,
  todayIn,
} from '@todist/shared';
import type { Db } from './client';
import { activityLog, tasks, users } from './schema';

// Sample data for local development only (never production). Idempotent: users are upserted
// by email; sample tasks are only added to an empty tasks table.

export interface DevSeedOptions {
  ownerEmail: string;
  editorEmail: string;
  timezone: string;
  now: number;
}

interface SampleTask {
  categoryId: CategoryId;
  title: string;
  priority: Priority | null;
  dueInDays?: number;
  durationMin?: number;
  completedDaysAgo?: number;
}

const SAMPLE_TASKS: SampleTask[] = [
  {
    categoryId: 'canonical',
    title: 'Prepare quarterly report',
    priority: 'P1',
    dueInDays: 5,
    durationMin: 120,
  },
  {
    categoryId: 'canonical',
    title: 'Review team roadmap document',
    priority: 'P2',
    durationMin: 60,
  },
  {
    categoryId: 'freexian',
    title: 'Prepare ELTS package updates',
    priority: 'P0',
    dueInDays: 1,
    durationMin: 90,
  },
  { categoryId: 'freexian', title: 'Triage LTS package backlog', priority: 'P2', durationMin: 30 },
  {
    categoryId: 'admin',
    title: 'Submit GST documents',
    priority: 'P1',
    dueInDays: 13,
    durationMin: 30,
  },
  {
    categoryId: 'admin',
    title: 'Pay executive assistant',
    priority: 'P0',
    dueInDays: 2,
    durationMin: 15,
  },
  { categoryId: 'admin', title: 'File invoices', priority: 'P3', durationMin: 20 },
  { categoryId: 'admin', title: 'Renew domain registration', priority: 'P2', completedDaysAgo: 1 },
  { categoryId: 'aspirational', title: 'Update LinkedIn', priority: 'WISH', durationMin: 30 },
  { categoryId: 'aspirational', title: 'Update GitHub profile', priority: null },
  { categoryId: 'aspirational', title: 'Hire a social media manager', priority: 'WISH' },
];

export async function seedDevData(db: Db, opts: DevSeedOptions): Promise<void> {
  const ownerId = await upsertUser(db, opts.ownerEmail, 'Owner (dev)', 'owner', opts);
  await upsertUser(db, opts.editorEmail, 'Editor (dev)', 'editor', opts);

  if ((await db.$count(tasks)) > 0) return;

  const today: PlainDate = todayIn(opts.timezone, new Date(opts.now));
  const DAY = 86_400_000;
  const rows = SAMPLE_TASKS.map((s, i) => {
    const createdAt = opts.now - (SAMPLE_TASKS.length - i) * 60_000;
    const completedAt =
      s.completedDaysAgo === undefined ? null : opts.now - s.completedDaysAgo * DAY;
    return {
      id: newId(),
      categoryId: s.categoryId,
      title: s.title,
      priority: s.priority,
      dueDate: s.dueInDays === undefined ? null : addDays(today, s.dueInDays),
      durationMin: s.durationMin ?? null,
      assigneeId: ownerId,
      completedAt,
      completedBy: completedAt === null ? null : ownerId,
      resolution: completedAt === null ? null : ('done' as const),
      createdBy: ownerId,
      createdAt,
      updatedAt: completedAt ?? createdAt,
    };
  });

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values(rows);
    await tx.insert(activityLog).values(
      rows.map((r) => ({
        occurredAt: r.createdAt,
        actorId: ownerId,
        entityType: 'task',
        entityId: r.id,
        type: 'task.created',
        dataJson: JSON.stringify({ source: 'dev-seed' }),
      })),
    );
  });
}

async function upsertUser(
  db: Db,
  email: string,
  name: string,
  role: 'owner' | 'editor',
  opts: DevSeedOptions,
): Promise<string> {
  const normalized = email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalized) });
  if (existing) return existing.id;
  const id = newId();
  await db.insert(users).values({
    id,
    email: normalized,
    name,
    role,
    status: 'active',
    timezone: opts.timezone,
    createdAt: opts.now,
    updatedAt: opts.now,
  });
  return id;
}
