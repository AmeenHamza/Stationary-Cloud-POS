import { Decimal, ZERO, sum } from '@pos/domain';

import { paymentMethodOf } from './payment-method.js';
import { flag, money, text } from './values.js';

import type { Issues } from './issues.js';
import type { LegacyRow } from '../legacy/schema-map.js';
import type { DiscountType, OrderStatus, PaymentMethod } from '@pos/contracts';

type OrderRow = LegacyRow<'orders'>;

/** The old discount type (flat / percentage); a discount without a type becomes a flat amount. */
export function discountTermsOf(
  row: OrderRow,
  discountTotal: Decimal,
  issues: Issues,
  ref: string,
): { type: DiscountType; value: Decimal } {
  const kind = text(row.discountType)?.toLowerCase() ?? '';
  const value = money(row.discountValue, issues, ref, 'discount value');
  if (kind.startsWith('percent')) {
    if (value.isNegative() || value.greaterThan(100)) {
      issues.block('invalid-value', ref, `discount ${value.toString()} % is outside 0–100`);
    }
    return { type: 'PERCENT', value };
  }
  if (kind === 'flat' || !discountTotal.isZero()) {
    return { type: 'FLAT', value: kind === 'flat' && !value.isNegative() ? value : discountTotal };
  }
  return { type: 'NONE', value: ZERO };
}

/** Bill GST (D-08): applied when flagged or charged; a charge without a rate takes the shop rate. */
export function billGstOf(
  row: OrderRow,
  shopRate: Decimal | null,
  issues: Issues,
  ref: string,
): { rate: Decimal | null; amount: Decimal } {
  const amount = money(row.billGstAmount, issues, ref, 'bill GST');
  if (flag(row.billGstApplied) !== true && amount.isZero()) {
    return { rate: null, amount: ZERO };
  }
  const rate =
    text(row.billGstPercentage) === null
      ? shopRate
      : money(row.billGstPercentage, issues, ref, 'GST rate');
  if (rate === null && !amount.isZero()) {
    issues.block('invalid-value', ref, 'bill GST charged without a rate');
  }
  return { rate, amount };
}

/** The amount the old app charged: its final-amount column, else the sum of the bill's payments. */
export function oldTotalOf(
  row: OrderRow,
  payments: readonly LegacyRow<'orderPayments'>[],
  issues: Issues,
  ref: string,
): Decimal | null {
  if (text(row.finalAmount) !== null) {
    return money(row.finalAmount, issues, ref, 'final amount');
  }
  return payments.length === 0
    ? null
    : sum(payments.map((payment) => money(payment.amount, issues, ref, 'payment')));
}

/** Payment rows that disagree with the bill's own method are reported; the bill's method is kept. */
export function checkPayments(
  method: PaymentMethod,
  payments: readonly LegacyRow<'orderPayments'>[],
  issues: Issues,
  ref: string,
): void {
  if (payments.length > 1) {
    issues.note('split-payment', ref, `${String(payments.length)} payments; kept as ${method}`);
  } else if (
    payments.length === 1 &&
    paymentMethodOf(payments[0]?.paymentMethod ?? null) !== method
  ) {
    issues.note(
      'split-payment',
      ref,
      `payment row says "${payments[0]?.paymentMethod ?? ''}"; kept as ${method}`,
    );
  }
}

/** The status follows the refunded amount; an old status that says otherwise is reported. */
export function statusOf(
  oldStatus: string | null,
  refunded: Decimal,
  total: Decimal,
  issues: Issues,
  ref: string,
): OrderStatus {
  const status: OrderStatus = refunded.isZero()
    ? 'COMPLETED'
    : refunded.equals(total)
      ? 'REFUNDED'
      : 'PARTIALLY_REFUNDED';
  const old = text(oldStatus)?.toLowerCase() ?? 'completed';
  const family = old.includes('partial')
    ? 'PARTIALLY_REFUNDED'
    : old.includes('refund')
      ? 'REFUNDED'
      : old === 'completed'
        ? 'COMPLETED'
        : null;
  if (family === null) {
    issues.block(
      'invalid-value',
      ref,
      `unknown bill status "${old}" (e.g. cancelled bills need a decision)`,
    );
  } else if (family !== status) {
    issues.note('status-differs', ref, `old status "${old}", refunded amount gives ${status}`);
  }
  return status;
}
