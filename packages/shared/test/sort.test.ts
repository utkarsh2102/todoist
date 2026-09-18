import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PRIORITIES } from '../src/priority';
import { compareCompleted, compareOpen, type SortableTask, sortQuadrant } from '../src/sort';

const task = (id: string, fields: Partial<SortableTask> = {}): SortableTask => ({
  id,
  priority: null,
  dueDate: null,
  dueTime: null,
  createdAt: 1_000,
  completedAt: null,
  ...fields,
});

describe('sortQuadrant', () => {
  it('orders a quadrant as specified in plan section C.1', () => {
    const expected = [
      task('p0-overdue', { priority: 'P0', dueDate: '2026-09-20' }),
      task('p0-timed', { priority: 'P0', dueDate: '2026-10-01', dueTime: '09:00' }),
      task('p0-allday', { priority: 'P0', dueDate: '2026-10-01' }),
      task('p0-undated-older', { priority: 'P0', createdAt: 100 }),
      task('p0-undated-newer', { priority: 'P0', createdAt: 200 }),
      task('p1', { priority: 'P1', dueDate: '2026-09-01' }),
      task('p2', { priority: 'P2' }),
      task('p3', { priority: 'P3' }),
      task('p4', { priority: 'P4' }),
      task('none-dated', { dueDate: '2026-12-31' }),
      task('none-undated'),
      task('wish-early-date', { priority: 'WISH', dueDate: '2026-01-01' }),
      task('done-recently', { priority: 'P0', completedAt: 9_000 }),
      task('done-earlier', { priority: 'WISH', completedAt: 5_000 }),
    ];
    const shuffled = [...expected].reverse();

    expect(sortQuadrant(shuffled).map((t) => t.id)).toEqual(expected.map((t) => t.id));
  });

  it('does not mutate its input', () => {
    const input = [task('b', { priority: 'P4' }), task('a', { priority: 'P0' })];
    const copy = [...input];
    sortQuadrant(input);
    expect(input).toEqual(copy);
  });
});

// Arbitrary tasks drawn from a small value space so that ties on every sort key are common.
const arbTask = fc.record({
  id: fc.integer({ min: 0, max: 15 }).map((n) => `t${n}`),
  priority: fc.constantFrom(null, ...PRIORITIES),
  dueDate: fc.constantFrom(null, '2026-09-30', '2026-10-01'),
  dueTime: fc.constantFrom(null, '09:00', '17:30'),
  createdAt: fc.constantFrom(1, 2),
  completedAt: fc.constantFrom(null, 10, 20),
});
// Real task ids are unique; with unique ids both comparators are strict total orders.
const arbQuadrant = fc.uniqueArray(arbTask, { selector: (t) => t.id, maxLength: 12 });

describe.each([
  ['compareOpen', compareOpen],
  ['compareCompleted', compareCompleted],
])('%s is a consistent total order', (_name, cmp) => {
  it('is reflexive and antisymmetric', () => {
    fc.assert(
      fc.property(arbTask, arbTask, (a, b) => {
        expect(Math.sign(cmp(a, a))).toBe(0);
        expect(Math.sign(cmp(a, b)) + Math.sign(cmp(b, a))).toBe(0);
      }),
    );
  });

  it('only calls distinct tasks equal when their ids match', () => {
    fc.assert(
      fc.property(arbTask, arbTask, (a, b) => {
        if (a.id !== b.id) expect(cmp(a, b)).not.toBe(0);
      }),
    );
  });

  it('is transitive', () => {
    fc.assert(
      fc.property(arbTask, arbTask, arbTask, (a, b, c) => {
        if (cmp(a, b) <= 0 && cmp(b, c) <= 0) expect(cmp(a, c)).toBeLessThanOrEqual(0);
      }),
    );
  });
});

describe('sortQuadrant properties', () => {
  it('gives the same result for any input order', () => {
    const tasksAndPermutation = arbQuadrant.chain((tasks) =>
      fc.tuple(
        fc.constant(tasks),
        fc.shuffledSubarray(tasks, { minLength: tasks.length, maxLength: tasks.length }),
      ),
    );
    fc.assert(
      fc.property(tasksAndPermutation, ([tasks, permuted]) => {
        expect(sortQuadrant(permuted)).toEqual(sortQuadrant(tasks));
      }),
    );
  });

  it('always lists open tasks before completed ones', () => {
    fc.assert(
      fc.property(arbQuadrant, (tasks) => {
        const sorted = sortQuadrant(tasks);
        const firstDone = sorted.findIndex((t) => t.completedAt !== null);
        if (firstDone >= 0)
          expect(sorted.slice(firstDone).every((t) => t.completedAt !== null)).toBe(true);
      }),
    );
  });
});
