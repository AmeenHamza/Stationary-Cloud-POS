import { DomainRuleError } from '../errors.js';

import { Decimal } from './decimal.js';
import { ZERO, sum } from './money.js';

export interface Allocation<T> {
  item: T;
  share: Decimal;
}

/**
 * Splits `total` across `items` in proportion to `weight(item)`, in whole paisa, using the
 * largest-remainder method. The shares always sum to `total` exactly; ties go to the earlier item
 * (A-01). Shares are returned paired with their items, in input order.
 */
export function allocate<T>(
  total: Decimal,
  items: readonly T[],
  weight: (item: T) => Decimal,
): Allocation<T>[] {
  const weights = items.map(weight);
  if (total.isNegative() || weights.some((w) => w.isNegative())) {
    throw new DomainRuleError('BAD_USER_INPUT', 'allocation inputs must not be negative');
  }
  const totalWeight = sum(weights);
  if (totalWeight.isZero()) {
    if (!total.isZero()) {
      throw new DomainRuleError('BAD_USER_INPUT', 'cannot allocate an amount over zero weight');
    }
    return items.map((item) => ({ item, share: ZERO }));
  }
  const totalPaisa = total.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const shares = items.map((item, index) => {
    const raw = totalPaisa.times(weight(item)).dividedBy(totalWeight);
    const floor = raw.toDecimalPlaces(0, Decimal.ROUND_FLOOR);
    return { item, index, floor, remainder: raw.minus(floor) };
  });
  const leftover = totalPaisa.minus(sum(shares.map((s) => s.floor))).toNumber();
  const order = [...shares].sort(
    (a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index,
  );
  const bonus = new Set(order.slice(0, leftover).map((s) => s.index));
  return shares.map((s) => ({
    item: s.item,
    share: (bonus.has(s.index) ? s.floor.plus(1) : s.floor).dividedBy(100),
  }));
}
