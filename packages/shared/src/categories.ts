// The four task queues, in grid order: top-left, top-right, bottom-left, bottom-right.
// IDs are stable slugs; display names are data in the `categories` table (renamable later).
export const CATEGORY_IDS = ['canonical', 'freexian', 'admin', 'aspirational'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const DEFAULT_CATEGORY_NAMES: Record<CategoryId, string> = {
  canonical: 'Canonical To-Do',
  freexian: 'Freexian To-Do',
  admin: 'Admin To-Do',
  aspirational: 'Aspirational To-Do',
};
