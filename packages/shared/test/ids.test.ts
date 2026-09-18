import { describe, expect, it } from 'vitest';
import { isId, newId } from '../src/ids';

describe('ids', () => {
  it('generates valid UUIDv7 ids', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isId(id)).toBe(true);
  });

  it('rejects other UUID versions and junk', () => {
    expect(isId('123e4567-e89b-42d3-a456-426614174000')).toBe(false);
    expect(isId('not-an-id')).toBe(false);
    expect(isId('')).toBe(false);
  });

  it('is time-ordered: ids sort in creation order', () => {
    const ids = Array.from({ length: 1000 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
  });
});
