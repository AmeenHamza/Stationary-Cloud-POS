import { DomainRuleError } from '../errors.js';

/** ISO calendar date `YYYY-MM-DD` in the business time zone (the `BusinessDate` scalar). */
export type BusinessDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The business date of an instant in `timeZone` (Asia/Karachi by default, Q18). */
export function businessDateOf(instant: Date, timeZone: string): BusinessDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function toUtc(date: BusinessDate): Date {
  const match = ISO_DATE.exec(date);
  if (match === null) {
    throw new DomainRuleError('BAD_USER_INPUT', `Invalid date "${date}"`, 'date');
  }
  // Exactly three capture groups are present after a match.
  const [year, month, day] = match.slice(1, 4).map((part) => Number.parseInt(part, 10)) as [
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== date) {
    throw new DomainRuleError('BAD_USER_INPUT', `Invalid date "${date}"`, 'date');
  }
  return parsed;
}

export function isBusinessDate(value: string): boolean {
  try {
    toUtc(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: BusinessDate, days: number): BusinessDate {
  const utc = toUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Monday of the week containing `date` (week starts Monday, Q18 default). */
export function startOfWeek(date: BusinessDate): BusinessDate {
  const weekday = toUtc(date).getUTCDay();
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export function startOfMonth(date: BusinessDate): BusinessDate {
  return `${date.slice(0, 7)}-01`;
}

/** First date still shown by default in order and ledger lists (D-12). */
export function archiveWindowStart(today: BusinessDate, windowDays: number): BusinessDate {
  return addDays(today, -windowDays);
}
