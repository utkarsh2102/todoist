import { type Priority, priorityRank } from './priority';

// Task ordering within a quadrant (docs/plan-v1.md, C.1). Used by the API to order responses
// and by the web app to re-sort optimistically, so both always agree.

export interface SortableTask {
  id: string;
  priority: Priority | null;
  dueDate: string | null;
  dueTime: string | null;
  createdAt: number;
  completedAt: number | null;
}

/** Open tasks: priority band → dated first → earliest due → timed before all-day → oldest → id. */
export function compareOpen(a: SortableTask, b: SortableTask): number {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    missingLast(a.dueDate, b.dueDate) ||
    compareText(a.dueDate, b.dueDate) ||
    missingLast(a.dueTime, b.dueTime) ||
    compareText(a.dueTime, b.dueTime) ||
    a.createdAt - b.createdAt ||
    compareText(a.id, b.id)
  );
}

/** Completed tasks waiting for the weekly archive: most recently completed first. */
export function compareCompleted(a: SortableTask, b: SortableTask): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0) || compareText(a.id, b.id);
}

/** Open tasks in priority order, followed by completed (not yet archived) tasks. */
export function sortQuadrant<T extends SortableTask>(tasks: readonly T[]): T[] {
  const open = tasks.filter((t) => t.completedAt === null).sort(compareOpen);
  const completed = tasks.filter((t) => t.completedAt !== null).sort(compareCompleted);
  return [...open, ...completed];
}

function missingLast(a: string | null, b: string | null): number {
  return Number(a === null) - Number(b === null);
}

function compareText(a: string | null, b: string | null): number {
  const x = a ?? '';
  const y = b ?? '';
  return x < y ? -1 : x > y ? 1 : 0;
}
