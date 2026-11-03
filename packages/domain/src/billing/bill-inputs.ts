import { money, percent } from '../money/money.js';

import type { BillDiscount, BillGst } from './bill.types.js';
import type { DiscountType } from '@pos/contracts';

/** Discount as entered (API `DiscountInput`, terminal cart): the value matching its type. */
export interface DiscountEntry {
  type: DiscountType;
  amount?: string | null | undefined;
  percent?: string | null | undefined;
}

/** Bill GST as entered (API `BillGstInput`): a rate only when applied. */
export interface BillGstEntry {
  applied: boolean;
  rate?: string | null | undefined;
}

/**
 * Parses the discount entry for `calculateBill`. The API and the cart preview share it, so both read
 * the same entry the same way; a missing or malformed value throws `DomainRuleError`.
 */
export function billDiscountOf(entry: DiscountEntry): BillDiscount {
  switch (entry.type) {
    case 'FLAT':
      return { type: 'FLAT', amount: money(entry.amount ?? '', 'Discount') };
    case 'PERCENT':
      return { type: 'PERCENT', percent: percent(entry.percent ?? '', 'Discount') };
    case 'NONE':
      return { type: 'NONE' };
  }
}

/** Parses the Bill GST entry for `calculateBill` (D-25). */
export function billGstOf(entry: BillGstEntry): BillGst {
  return entry.applied
    ? { applied: true, rate: percent(entry.rate ?? '', 'Bill GST rate') }
    : { applied: false };
}
