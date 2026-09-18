// Floating calendar dates ('YYYY-MM-DD') and times ('HH:MM'): no time zone is attached, so
// "2 Oct" means 2 Oct wherever you are. Arithmetic runs on UTC dates, so DST never shifts a day.

/** A validated calendar date string, 'YYYY-MM-DD'. */
export type PlainDate = string;
/** A validated wall-clock time string, 'HH:MM' (24 h). */
export type PlainTime = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function daysInMonth(year: number, month: number): number {
  return utcDate(year, month + 1, 0).getUTCDate();
}

export function isPlainDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function isPlainTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** ISO dates order lexicographically, so string comparison is date comparison. */
export function compareDates(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const [year, month, day] = toParts(date);
  return fromUtcDate(utcDate(year, month, day + days));
}

/** Today's date in an IANA time zone, e.g. todayIn('Asia/Kolkata'). */
export function todayIn(timeZone: string, now: Date = new Date()): PlainDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function toParts(date: PlainDate): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m || !isPlainDate(date)) throw new RangeError(`Invalid date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Date.UTC maps years 0–99 to 1900–1999; setUTCFullYear does not.
function utcDate(year: number, month: number, day: number): Date {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d;
}

function fromUtcDate(d: Date): PlainDate {
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
