import { z } from 'zod';

import { MONEY_INPUT_MAX, SEARCH_MAX_CHARS } from '@pos/contracts';
import { Decimal, isBusinessDate, isMoneyString, isPercentString } from '@pos/domain';

/** Shared atoms for every input schema (INSTRUCTIONS.md §5). */

export const idSchema = z.uuid({ error: 'Invalid id' });

/** Client-generated UUIDv7, one per user action (ADR-015). */
export const idempotencyKeySchema = z.uuid({ error: 'Invalid idempotency key' });

/** Optimistic-lock version (DATABASE.md §1.7). */
export const versionSchema = z.int().min(1);

/** Required, trimmed text of `min`–`max` characters. */
export function requiredText(max: number, label: string, min = 1) {
  return z
    .string()
    .trim()
    .min(min, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${String(max)} characters` });
}

/** Optional trimmed text; empty input becomes null. */
export function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, { error: `${label} must be at most ${String(max)} characters` })
    .nullish()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value));
}

const MAX = new Decimal(MONEY_INPUT_MAX);

/** Non-negative amount in the `Money` wire format, at most numeric(12,2). */
export const moneySchema = z
  .string()
  .trim()
  .refine((value) => isMoneyString(value) && !value.startsWith('-'), {
    error: 'Enter an amount with at most 2 decimals',
  })
  .refine((value) => !isMoneyString(value) || new Decimal(value).lessThanOrEqualTo(MAX), {
    error: 'Amount is too large',
  });

/** Optional amount: an empty field or null becomes null (e.g. box price, cost price). */
export const optionalMoneySchema = z
  .union([z.literal(''), moneySchema])
  .nullish()
  .transform((value) => (value === undefined || value === null || value === '' ? null : value));

/** Strictly positive amount (khata entries, refunds). */
export const positiveMoneySchema = moneySchema.refine(
  (value) => !isMoneyString(value) || new Decimal(value).greaterThan(0),
  { error: 'Amount must be greater than zero' },
);

/** Percentage 0–100 with up to 2 decimals (tax rates, discounts). */
export const percentSchema = z
  .string()
  .trim()
  .refine(isPercentString, { error: 'Enter a percentage from 0 to 100 with at most 2 decimals' });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, {
    error: 'Username: 3–40 lowercase letters, digits, dot, dash or underscore',
  });

export const passwordSchema = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters' })
  .max(128, { error: 'Password must be at most 128 characters' });

/** Optional phone: free format as typed, but it must contain 7–15 digits when given. */
export const phoneSchema = optionalText(30, 'Phone').refine(
  (value) => value === null || /^\d{7,15}$/.test(value.replace(/\D/g, '')),
  { error: 'Enter a valid phone number' },
);

/** Optional email; an empty field becomes null. */
export const emailSchema = z
  .union([z.literal(''), z.email({ error: 'Enter a valid email address' }).max(254)])
  .nullish()
  .transform((value) => (value === undefined || value === null || value === '' ? null : value));

/** Free-text search box (API.md §10.1). */
export const searchSchema = z.string().trim().min(1).max(SEARCH_MAX_CHARS);

/** A business date `YYYY-MM-DD` (Asia/Karachi calendar day, API.md §2). */
export const businessDateSchema = z
  .string()
  .refine(isBusinessDate, { error: 'Use the date format YYYY-MM-DD' });
