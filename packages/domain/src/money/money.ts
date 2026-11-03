import { DomainRuleError } from '../errors.js';

import { Decimal } from './decimal.js';

/** Wire format of the `Money` scalar: up to 10 integer digits and 2 decimals (API.md §2). */
const MONEY_PATTERN = /^-?\d{1,10}(\.\d{1,2})?$/;
/** Wire format of the `Percent` scalar: 0–100 with up to 2 decimals. */
const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

export const ZERO = new Decimal(0);

export function isMoneyString(value: string): boolean {
  return MONEY_PATTERN.test(value);
}

/** True for a `Percent` wire value: 0–100 with up to 2 decimals. */
export function isPercentString(value: string): boolean {
  return PERCENT_PATTERN.test(value) && new Decimal(value).lessThanOrEqualTo(100);
}

/** Parses a money string or passes a Decimal through. Rejects floats and >2 decimals. */
export function money(value: string | Decimal, field = 'amount'): Decimal {
  if (typeof value !== 'string') {
    return value;
  }
  if (!isMoneyString(value)) {
    throw new DomainRuleError(
      'BAD_USER_INPUT',
      `${field} must be an amount with at most 2 decimals`,
      field,
    );
  }
  return new Decimal(value);
}

/** Parses a percentage (0–100, ≤ 2 decimals). */
export function percent(value: string | Decimal, field = 'percent'): Decimal {
  const parsed =
    typeof value === 'string' && PERCENT_PATTERN.test(value) ? new Decimal(value) : value;
  if (typeof parsed === 'string' || parsed.isNegative() || parsed.greaterThan(100)) {
    throw new DomainRuleError('BAD_USER_INPUT', `${field} must be between 0 and 100`, field);
  }
  return parsed;
}

/** Rounds half-up to the paisa (A-02). */
export function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sum(values: readonly Decimal[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(value), ZERO);
}

/** `percentage` % of `amount`, rounded to the paisa. */
export function percentOf(amount: Decimal, percentage: Decimal): Decimal {
  return round2(amount.times(percentage).dividedBy(100));
}

/** Serializes to the `Money` wire format, always with exactly 2 decimals. */
export function toMoneyString(value: Decimal): string {
  return round2(value).toFixed(2);
}
