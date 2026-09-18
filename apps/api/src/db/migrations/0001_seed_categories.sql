-- Reference data: the four task queues in grid order (docs/plan-v1.md, Product & UX spec).
-- Display names are data and may be renamed later; ids are stable.
INSERT OR IGNORE INTO `categories` (`id`, `name`, `position`, `created_at`, `updated_at`) VALUES
  ('canonical', 'Canonical To-Do', 0, unixepoch() * 1000, unixepoch() * 1000),
  ('freexian', 'Freexian To-Do', 1, unixepoch() * 1000, unixepoch() * 1000),
  ('admin', 'Admin To-Do', 2, unixepoch() * 1000, unixepoch() * 1000),
  ('aspirational', 'Aspirational To-Do', 3, unixepoch() * 1000, unixepoch() * 1000);
