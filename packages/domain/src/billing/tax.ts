import { DomainRuleError } from '../errors.js';
import { ZERO, percentOf } from '../money/money.js';

import type { BillGst } from './bill.types.js';
import type { Decimal } from '../money/decimal.js';

function assertRate(rate: Decimal, field: string): void {
  if (rate.isNegative() || rate.greaterThan(100)) {
    throw new DomainRuleError('BAD_USER_INPUT', 'Tax rate must be between 0 and 100', field);
  }
}

/** Product tax on a discounted line, added on top (D-07, D-08), rounded per line (A-02). */
export function lineTax(lineNet: Decimal, taxRate: Decimal): Decimal {
  assertRate(taxRate, 'taxRate');
  return percentOf(lineNet, taxRate);
}

/**
 * Optional Bill GST (BR-07) on the discounted subtotal **plus** product tax (D-25),
 * rounded once per bill (A-02).
 */
export function billGstAmount(base: Decimal, gst: BillGst): Decimal {
  if (!gst.applied) {
    return ZERO;
  }
  assertRate(gst.rate, 'billGst');
  return percentOf(base, gst.rate);
}
