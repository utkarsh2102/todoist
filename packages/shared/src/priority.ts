export const PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4', 'WISH'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
  WISH: 'Wish',
};

// Sort rank (docs/plan-v1.md, C.1). Tasks without a priority are untriaged but actionable:
// they sort after P4 and before the Wish List.
const RANK: Record<Priority | 'none', number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  none: 5,
  WISH: 6,
};

export function priorityRank(priority: Priority | null): number {
  return RANK[priority ?? 'none'];
}
