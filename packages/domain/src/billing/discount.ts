import { DomainRuleError } from '../errors.js';
import { ZERO, percentOf } from '../money/money.js';

import type { BillDiscount } from './bill.types.js';
import type { Decimal } from '../money/decimal.js';

/**
 * Total bill discount (BR-06): none, a flat amount (≤ subtotal), or a percentage (0–100) of the
 * subtotal rounded half-up to the paisa. Applied before any tax (D-08).
 */
export function discountTotal(subtotal: Decimal, discount: BillDiscount): Decimal {
  switch (discount.type) {
    case 'NONE':
      return ZERO;
    case 'FLAT':
      if (discount.amount.isNegative() || discount.amount.greaterThan(subtotal)) {
        throw new DomainRuleError(
          'BAD_USER_INPUT',
          'Flat discount must be between 0 and the subtotal',
          'discount',
        );
      }
      return discount.amount;
    case 'PERCENT':
      if (discount.percent.isNegative() || discount.percent.greaterThan(100)) {
        throw new DomainRuleError(
          'BAD_USER_INPUT',
          'Discount percentage must be between 0 and 100',
          'discount',
        );
      }
      return percentOf(subtotal, discount.percent);
  }
}
