import { createHash } from 'node:crypto';

import { Decimal, round2 } from '@pos/domain';

import type { Issues } from './issues.js';

/** A trimmed text value, or null when empty. */
export function text(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Text that fits `max` characters; longer values are cut and reported. */
export function capped(
  value: string | null,
  max: number,
  issues: Issues,
  ref: string,
  field: string,
): string | null {
  const trimmed = text(value);
  if (trimmed === null || trimmed.length <= max) {
    return trimmed;
  }
  issues.note('text-truncated', ref, `${field} cut to ${String(max)} characters`);
  return trimmed.slice(0, max);
}

/** A number read as text (any precision, including double precision), or null. */
export function decimal(value: string | null): Decimal | null {
  const trimmed = text(value);
  if (trimmed === null) {
    return null;
  }
  try {
    const parsed = new Decimal(trimmed);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/** Money rounded to the paisa; null reads as `fallback`, a non-number blocks the record. */
export function money(
  value: string | null,
  issues: Issues,
  ref: string,
  field: string,
  fallback: Decimal = new Decimal(0),
): Decimal {
  if (text(value) === null) {
    return fallback;
  }
  const parsed = decimal(value);
  if (parsed === null) {
    issues.block('invalid-value', ref, `${field} is not a number: "${value ?? ''}"`);
    return fallback;
  }
  return round2(parsed);
}

/** A whole number, or null when empty or not whole. */
export function integer(value: string | null): number | null {
  const parsed = decimal(value);
  return parsed?.isInteger() === true ? parsed.toNumber() : null;
}

export function flag(value: string | null): boolean | null {
  const normalized = text(value)?.toLowerCase();
  if (normalized === undefined) {
    return null;
  }
  return ['true', 't', '1', 'yes', 'y'].includes(normalized);
}

/** An ISO instant from the reader (already UTC), or null. */
export function instant(value: string | null): Date | null {
  const trimmed = text(value);
  if (trimmed === null) {
    return null;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A stable UUID for an old record (name-based, RFC 4122 version 5 layout): re-runs produce the same
 * ids, so inserts skip rows that already exist (DATABASE.md §11 step 2).
 */
export function legacyUuid(kind: string, legacyId: string): string {
  const bytes = createHash('sha1')
    .update(`pos-legacy:${kind}:${legacyId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
