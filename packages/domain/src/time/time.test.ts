import { describe, expect, it } from 'vitest';

import {
  addDays,
  archiveWindowStart,
  businessDateOf,
  isBusinessDate,
  startOfMonth,
  startOfWeek,
} from './business-date.js';
import { formatBusinessDate, formatDate, formatDateTime } from './format-date.js';

const KARACHI = 'Asia/Karachi';

describe('business dates (Asia/Karachi, UTC+5)', () => {
  it('rolls over at local midnight, not UTC midnight', () => {
    expect(businessDateOf(new Date('2026-10-28T18:59:59Z'), KARACHI)).toBe('2026-10-28');
    expect(businessDateOf(new Date('2026-10-28T19:00:00Z'), KARACHI)).toBe('2026-10-29');
  });

  it('does date arithmetic across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(archiveWindowStart('2026-10-29', 90)).toBe('2026-07-31');
    expect(startOfMonth('2026-10-29')).toBe('2026-10-01');
  });

  it('starts weeks on Monday (Q18 default)', () => {
    expect(startOfWeek('2026-10-28')).toBe('2026-10-26');
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
  });

  it('validates ISO dates', () => {
    expect(isBusinessDate('2026-02-29')).toBe(false);
    expect(isBusinessDate('2028-02-29')).toBe(true);
    expect(isBusinessDate('28/10/2026')).toBe(false);
    expect(() => addDays('nope', 1)).toThrow(/Invalid date/);
  });
});

describe('display formats (Q24 default)', () => {
  const instant = new Date('2026-10-28T17:09:06Z');

  it('formats DD/MM/YYYY in the business time zone', () => {
    expect(formatDate(instant, KARACHI)).toBe('28/10/2026');
    expect(formatBusinessDate('2026-10-28')).toBe('28/10/2026');
  });

  it('formats a 12-hour time', () => {
    expect(formatDateTime(instant, KARACHI)).toBe('28/10/2026, 10:09 pm');
    expect(formatDateTime(new Date('2026-10-28T04:05:00Z'), KARACHI)).toBe('28/10/2026, 9:05 am');
  });
});
