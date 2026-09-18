import { describe, expect, it } from 'vitest';
import { newId } from '../src/ids';
import {
  DurationSchema,
  IdSchema,
  LinkSchema,
  LinksSchema,
  PlainDateSchema,
  TaskSchema,
  TaskTitleSchema,
} from '../src/schemas';

describe('TaskTitleSchema', () => {
  it('trims and accepts a title', () => {
    expect(TaskTitleSchema.parse('  Submit GST documents  ')).toBe('Submit GST documents');
  });

  it('rejects empty and whitespace-only titles', () => {
    expect(TaskTitleSchema.safeParse('').success).toBe(false);
    expect(TaskTitleSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects titles over 300 characters', () => {
    expect(TaskTitleSchema.safeParse('x'.repeat(301)).success).toBe(false);
    expect(TaskTitleSchema.safeParse('x'.repeat(300)).success).toBe(true);
  });
});

describe('LinkSchema', () => {
  it('accepts http and https URLs with an optional label', () => {
    expect(LinkSchema.parse({ url: 'https://docs.google.com/document/d/abc' })).toEqual({
      url: 'https://docs.google.com/document/d/abc',
    });
    expect(LinkSchema.safeParse({ url: 'http://example.com', label: 'Example' }).success).toBe(
      true,
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>x</script>',
    'ftp://example.com/x',
    'file:///etc/passwd',
    'not a url',
  ])('rejects %s', (url) => {
    expect(LinkSchema.safeParse({ url }).success).toBe(false);
  });

  it('rejects unknown fields and more than 20 links', () => {
    expect(LinkSchema.safeParse({ url: 'https://a.example', extra: 1 }).success).toBe(false);
    const links = Array.from({ length: 21 }, (_, i) => ({ url: `https://example.com/${i}` }));
    expect(LinksSchema.safeParse(links).success).toBe(false);
  });
});

describe('value schemas', () => {
  it('validates dates, durations and ids', () => {
    expect(PlainDateSchema.safeParse('2026-10-02').success).toBe(true);
    expect(PlainDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(DurationSchema.safeParse(30).success).toBe(true);
    expect(DurationSchema.safeParse(0).success).toBe(false);
    expect(DurationSchema.safeParse(1.5).success).toBe(false);
    expect(IdSchema.safeParse(newId()).success).toBe(true);
    expect(IdSchema.safeParse('123e4567-e89b-42d3-a456-426614174000').success).toBe(false); // v4
  });

  it('parses a complete task DTO', () => {
    const id = newId();
    const owner = newId();
    const dto = {
      id,
      categoryId: 'admin',
      title: 'Submit GST documents',
      descriptionMd: '',
      priority: 'P1',
      dueDate: '2026-10-10',
      dueTime: null,
      durationMin: 30,
      assigneeId: owner,
      links: [],
      completedAt: null,
      completedBy: null,
      resolution: null,
      archivedAt: null,
      createdBy: owner,
      createdAt: 1,
      updatedAt: 1,
      version: 1,
    };
    expect(TaskSchema.parse(dto)).toEqual(dto);
    expect(TaskSchema.safeParse({ ...dto, categoryId: 'personal' }).success).toBe(false);
  });
});
