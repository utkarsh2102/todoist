import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDates,
  daysInMonth,
  isPlainDate,
  isPlainTime,
  isValidTimeZone,
  todayIn,
} from '../src/dates';

describe('isPlainDate', () => {
  it.each(['2026-09-27', '2028-02-29', '2026-12-31', '0099-01-01'])('accepts %s', (d) => {
    expect(isPlainDate(d)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-09-31', '2026-9-1', '26-09-27', ''])(
    'rejects %s',
    (d) => {
      expect(isPlainDate(d)).toBe(false);
    },
  );
});

describe('isPlainTime', () => {
  it.each(['00:00', '09:05', '23:59'])('accepts %s', (t) => expect(isPlainTime(t)).toBe(true));
  it.each(['24:00', '9:05', '12:60', '12:5', '12:00:00'])('rejects %s', (t) =>
    expect(isPlainTime(t)).toBe(false),
  );
});

describe('date arithmetic', () => {
  it('knows month lengths, including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 9)).toBe(30);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-27', 7)).toBe('2026-10-04');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('0099-12-31', 1)).toBe('0100-01-01');
  });

  it('is unaffected by DST changes (floating dates)', () => {
    // Europe switches to winter time on 2026-10-25; the date still advances by exactly one day.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('rejects invalid input', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });

  it('compares ISO dates', () => {
    expect(compareDates('2026-09-27', '2026-10-01')).toBe(-1);
    expect(compareDates('2026-10-01', '2026-10-01')).toBe(0);
    expect(compareDates('2027-01-01', '2026-12-31')).toBe(1);
  });
});

describe('todayIn', () => {
  const instant = new Date('2026-09-27T20:00:00Z');

  it('returns the local date in the given time zone', () => {
    expect(todayIn('Asia/Kolkata', instant)).toBe('2026-09-28'); // 01:30 IST next day
    expect(todayIn('Europe/Berlin', instant)).toBe('2026-09-27');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-09-27');
    expect(todayIn('UTC', instant)).toBe('2026-09-27');
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects junk', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });
});
