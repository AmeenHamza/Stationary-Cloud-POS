/** Display formats for dates and times in the business time zone (Q24 default: DD/MM/YYYY). */

type DatePart = 'day' | 'month' | 'year' | 'hour' | 'minute' | 'dayPeriod';

function parts(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Record<DatePart, string> {
  const list = new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).formatToParts(instant);
  // The requested options guarantee the parts each caller reads.
  return Object.fromEntries(list.map((part) => [part.type, part.value])) as Record<
    DatePart,
    string
  >;
}

/** A business date "2026-10-28" as "28/10/2026" (no time zone involved: it is already a date). */
export function formatBusinessDate(date: string): string {
  return date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
}

/** "28/10/2026" */
export function formatDate(instant: Date, timeZone: string): string {
  const p = parts(instant, timeZone, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.day}/${p.month}/${p.year}`;
}

/** "28/10/2026, 10:09 pm" (12-hour clock) */
export function formatDateTime(instant: Date, timeZone: string): string {
  const p = parts(instant, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${formatDate(instant, timeZone)}, ${p.hour}:${p.minute} ${p.dayPeriod.toLowerCase()}`;
}
