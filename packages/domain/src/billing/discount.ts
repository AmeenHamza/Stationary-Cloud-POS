import { DomainRuleError } from '../errors.js';
import { ZERO, percentOf } from '../money/money.js';

import type { BillDiscount } from './bill.types.js';
import type { Decimal } from '../money/decimal.js';

interface DiscountRefusals {
  flat: string;
  percent: string;
  field: string;
}

const BILL: DiscountRefusals = {
  flat: 'Flat discount must be between 0 and the bill amount',
  percent: 'Discount percentage must be between 0 and 100',
  field: 'discount',
};

const ITEM: DiscountRefusals = {
  flat: "Item discount must be between 0 and the item's amount",
  percent: 'Item discount percentage must be between 0 and 100',
  field: 'lines',
};

/** None, a flat amount (≤ `base`), or a percentage (0–100) of `base`, half-up to the paisa. */
function amountOff(base: Decimal, discount: BillDiscount, refuse: DiscountRefusals): Decimal {
  switch (discount.type) {
    case 'NONE':
      return ZERO;
    case 'FLAT':
      if (discount.amount.isNegative() || discount.amount.greaterThan(base)) {
        throw new DomainRuleError('BAD_USER_INPUT', refuse.flat, refuse.field);
      }
      return discount.amount;
    case 'PERCENT':
      if (discount.percent.isNegative() || discount.percent.greaterThan(100)) {
        throw new DomainRuleError('BAD_USER_INPUT', refuse.percent, refuse.field);
      }
      return percentOf(base, discount.percent);
  }
}

/**
 * The bill discount (BR-06), taken from what is left after item discounts (D-27) and before any tax
 * (D-08). With no item discounts `base` is the subtotal.
 */
export function discountTotal(base: Decimal, discount: BillDiscount): Decimal {
  return amountOff(base, discount, BILL);
}

/** A discount on one item (D-27): a flat amount off the line's total, or a percentage of it. */
export function itemDiscount(lineGross: Decimal, discount: BillDiscount): Decimal {
  return amountOff(lineGross, discount, ITEM);
}
