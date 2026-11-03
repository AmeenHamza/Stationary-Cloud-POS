import type { BusinessDate } from '@pos/domain';

/** A PostgreSQL `date` column (read by Prisma as UTC midnight) as `YYYY-MM-DD`. */
export function dateColumn(value: Date): BusinessDate {
  return value.toISOString().slice(0, 10);
}

/** A `YYYY-MM-DD` business date as the value Prisma writes to a `date` column. */
export function toDateColumn(value: BusinessDate): Date {
  return new Date(`${value}T00:00:00Z`);
}
