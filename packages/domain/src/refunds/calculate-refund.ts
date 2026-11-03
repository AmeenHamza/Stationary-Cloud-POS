import { DomainRuleError } from '../errors.js';
import { Decimal } from '../money/decimal.js';
import { ZERO, round2, sum } from '../money/money.js';

import type {
  RefundOrderSnapshot,
  RefundRequestLine,
  RefundResult,
  RefundableLine,
} from './refund.types.js';

function remaining(line: RefundableLine): number {
  return line.quantity - line.refundedQuantity;
}

/** Proportional amount, capped so earlier rounding can never push the total past what was paid. */
function shareOf(
  value: Decimal,
  part: number | Decimal,
  whole: number | Decimal,
  left: Decimal,
): Decimal {
  return Decimal.min(round2(value.times(part).dividedBy(whole)), left);
}

function priceLine(line: RefundableLine, quantity: number): Decimal {
  const lineValue = line.lineNet.plus(line.lineTax);
  const left = lineValue.minus(line.refundedAmount);
  // The refund that clears a line takes the exact remainder (A-06).
  return quantity === remaining(line) ? left : shareOf(lineValue, quantity, line.quantity, left);
}

function resolveLines(order: RefundOrderSnapshot, request: readonly RefundRequestLine[]) {
  if (request.length === 0) {
    throw new DomainRuleError('BAD_USER_INPUT', 'Select at least one item to refund', 'lines');
  }
  const byId = new Map(order.lines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  return request.map((entry) => {
    const line = byId.get(entry.lineId);
    if (line === undefined || seen.has(entry.lineId)) {
      throw new DomainRuleError('BAD_USER_INPUT', 'Unknown or repeated bill line', 'lines');
    }
    seen.add(entry.lineId);
    const valid = Number.isInteger(entry.quantity) && entry.quantity >= 1;
    if (!valid || entry.quantity > remaining(line)) {
      throw new DomainRuleError(
        'REFUND_EXCEEDS_REMAINING',
        'Refund quantity exceeds what remains',
        'lines',
      );
    }
    return { line, quantity: entry.quantity };
  });
}

/**
 * Refund amounts (SYSTEM_DESIGN.md §3.2, A-06): each line returns its share of (net + product
 * tax); Bill GST is returned in proportion; the refund that completes the order returns the exact
 * GST remainder, so a full refund always equals the bill total.
 */
export function calculateRefund(
  order: RefundOrderSnapshot,
  request: readonly RefundRequestLine[],
): RefundResult {
  const chosen = resolveLines(order, request);
  const lines = chosen.map(({ line, quantity }) => ({
    lineId: line.id,
    quantity,
    amount: priceLine(line, quantity),
  }));
  const requested = new Map(chosen.map((c) => [c.line.id, c.quantity]));
  const completesOrder = order.lines.every(
    (line) => (requested.get(line.id) ?? 0) === remaining(line),
  );
  const gstLeft = order.billGstAmount.minus(order.refundedGstShare);
  const linesTotal = sum(lines.map((l) => l.amount));
  const base = sum(order.lines.map((l) => l.lineNet.plus(l.lineTax)));
  let gstShare = ZERO;
  if (completesOrder) {
    gstShare = gstLeft;
  } else if (!base.isZero()) {
    gstShare = shareOf(order.billGstAmount, linesTotal, base, gstLeft);
  }
  const amount = linesTotal.plus(gstShare);
  if (!amount.greaterThan(0)) {
    throw new DomainRuleError(
      'BAD_USER_INPUT',
      'Nothing to refund for the selected items',
      'lines',
    );
  }
  return { lines, gstShare, amount, completesOrder };
}

/** The request that refunds every remaining unit ("Refund All"). */
export function refundAllRequest(order: RefundOrderSnapshot): RefundRequestLine[] {
  return order.lines
    .filter((line) => remaining(line) > 0)
    .map((line) => ({ lineId: line.id, quantity: remaining(line) }));
}
