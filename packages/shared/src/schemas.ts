import { z } from 'zod';
import { CATEGORY_IDS } from './categories';
import { isPlainDate, isPlainTime } from './dates';
import { isId } from './ids';
import { PRIORITIES } from './priority';

// Value schemas shared by the API (request validation) and the web app (forms, API responses).

export const IdSchema = z.string().refine(isId, 'Expected a UUIDv7 id');
export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export const PrioritySchema = z.enum(PRIORITIES);
export const PlainDateSchema = z.string().refine(isPlainDate, 'Expected a date as YYYY-MM-DD');
export const PlainTimeSchema = z.string().refine(isPlainTime, 'Expected a time as HH:MM');

export const TITLE_MAX = 300;
export const DESCRIPTION_MAX = 50_000;

export const TaskTitleSchema = z.string().trim().min(1, 'A title is required').max(TITLE_MAX);
export const DescriptionSchema = z.string().max(DESCRIPTION_MAX);
export const DurationSchema = z
  .number()
  .int()
  .min(1)
  .max(24 * 60);

// Links are user content: only http(s) URLs are accepted, so a link can never run script.
export const LinkSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/, error: 'Links must be http:// or https:// URLs' }).max(2048),
  label: z.string().trim().min(1).max(100).optional(),
});
export const LinksSchema = z.array(LinkSchema).max(20);
export type Link = z.infer<typeof LinkSchema>;

export const ResolutionSchema = z.enum(['done', 'skipped']);

/** A task as the API returns it (soft-deleted tasks are never returned). */
export const TaskSchema = z.object({
  id: IdSchema,
  categoryId: CategoryIdSchema,
  title: z.string(),
  descriptionMd: z.string(),
  priority: PrioritySchema.nullable(),
  dueDate: PlainDateSchema.nullable(),
  dueTime: PlainTimeSchema.nullable(),
  durationMin: DurationSchema.nullable(),
  assigneeId: IdSchema.nullable(),
  links: LinksSchema,
  completedAt: z.number().int().nullable(),
  completedBy: IdSchema.nullable(),
  resolution: ResolutionSchema.nullable(),
  archivedAt: z.number().int().nullable(),
  createdBy: IdSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  version: z.number().int().min(1),
});
export type Task = z.infer<typeof TaskSchema>;
