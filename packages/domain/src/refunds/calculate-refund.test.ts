import { describe, expect, it } from 'vitest';

import { calculateBill } from '../billing/calculate-bill.js';
import { Decimal } from '../money/decimal.js';
import { sum, toMoneyString } from '../money/money.js';

import { calculateRefund, refundAllRequest } from './calculate-refund.js';

import type { RefundOrderSnapshot, RefundRequestLine } from './refund.types.js';

const d = (value: string): Decimal => new Decimal(value);

/** A bill of 3 × 33.33 (10 % tax) + 1 × 50, 10 % discount, 18 % Bill GST, as stored on an order. */
function sampleOrder(): RefundOrderSnapshot {
  const bill = calculateBill(
    [
      { unitPrice: d('33.33'), quantity: 3, taxRate: d('10') },
      { unitPrice: d('50'), quantity: 1, taxRate: d('0') },
    ],
    { type: 'PERCENT', percent: d('10') },
    { applied: true, rate: d('18') },
  );
  return {
    lines: bill.lines.map((line, index) => ({
      id: `L${String(index + 1)}`,
      quantity: index === 0 ? 3 : 1,
      refundedQuantity: 0,
      lineNet: line.lineNet,
      lineTax: line.lineTax,
      refundedAmount: d('0'),
    })),
    billGstAmount: bill.billGstAmount,
    refundedGstShare: d('0'),
  };
}

/** Applies a refund result to the snapshot, like the API does to the order rows. */
function apply(order: RefundOrderSnapshot, request: RefundRequestLine[]): RefundOrderSnapshot {
  const result = calculateRefund(order, request);
  return {
    billGstAmount: order.billGstAmount,
    refundedGstShare: order.refundedGstShare.plus(result.gstShare),
    lines: order.lines.map((line) => {
      const done = result.lines.find((l) => l.lineId === line.id);
      return done === undefined
        ? line
        : {
            ...line,
            refundedQuantity: line.refundedQuantity + done.quantity,
            refundedAmount: line.refundedAmount.plus(done.amount),
          };
    }),
  };
}

describe('calculateRefund (A-06, FIN-15)', () => {
  it('refunds part of a line proportionally, including a Bill GST share', () => {
    const result = calculateRefund(sampleOrder(), [{ lineId: 'L1', quantity: 1 }]);
    expect(result.completesOrder).toBe(false);
    expect(result.amount.equals(sum(result.lines.map((l) => l.amount)).plus(result.gstShare))).toBe(
      true,
    );
    expect(result.gstShare.greaterThan(0)).toBe(true);
  });

  it('a sequence of partial refunds adds up to the bill total exactly', () => {
    let order = sampleOrder();
    const steps: RefundRequestLine[][] = [
      [{ lineId: 'L1', quantity: 1 }],
      [{ lineId: 'L2', quantity: 1 }],
      [{ lineId: 'L1', quantity: 2 }],
    ];
    const refunded: Decimal[] = [];
    for (const step of steps) {
      refunded.push(calculateRefund(order, step).amount);
      order = apply(order, step);
    }
    const bill = sampleOrder();
    const billTotal = sum(bill.lines.map((l) => l.lineNet.plus(l.lineTax))).plus(
      bill.billGstAmount,
    );
    expect(toMoneyString(sum(refunded))).toBe(toMoneyString(billTotal));
    expect(order.refundedGstShare.equals(bill.billGstAmount)).toBe(true);
  });

  it('"Refund All" returns everything that remains and completes the order', () => {
    const order = apply(sampleOrder(), [{ lineId: 'L1', quantity: 1 }]);
    const request = refundAllRequest(order);
    expect(request).toEqual([
      { lineId: 'L1', quantity: 2 },
      { lineId: 'L2', quantity: 1 },
    ]);
    expect(calculateRefund(order, request).completesOrder).toBe(true);
    expect(refundAllRequest(apply(order, request))).toEqual([]);
  });

  it('works for bills without Bill GST', () => {
    const order = { ...sampleOrder(), billGstAmount: d('0') };
    expect(calculateRefund(order, [{ lineId: 'L2', quantity: 1 }]).gstShare.isZero()).toBe(true);
  });

  it('rejects over-refunds, unknown or repeated lines and empty requests', () => {
    const order = sampleOrder();
    expect(() => calculateRefund(order, [{ lineId: 'L1', quantity: 4 }])).toThrow(/exceeds/);
    expect(() => calculateRefund(order, [{ lineId: 'L1', quantity: 0 }])).toThrow(/exceeds/);
    expect(() => calculateRefund(order, [{ lineId: 'X', quantity: 1 }])).toThrow(/Unknown/);
    const repeated = [
      { lineId: 'L1', quantity: 1 },
      { lineId: 'L1', quantity: 1 },
    ];
    expect(() => calculateRefund(order, repeated)).toThrow(/repeated/);
    expect(() => calculateRefund(order, [])).toThrow(/at least one/);
  });

  it('rejects a refund worth nothing', () => {
    const free: RefundOrderSnapshot = {
      lines: [
        {
          id: 'F',
          quantity: 1,
          refundedQuantity: 0,
          lineNet: d('0'),
          lineTax: d('0'),
          refundedAmount: d('0'),
        },
      ],
      billGstAmount: d('0'),
      refundedGstShare: d('0'),
    };
    expect(() => calculateRefund(free, [{ lineId: 'F', quantity: 1 }])).toThrow(
      /Nothing to refund/,
    );
    const freePair = { ...free, lines: free.lines.map((l) => ({ ...l, quantity: 2 })) };
    expect(() => calculateRefund(freePair, [{ lineId: 'F', quantity: 1 }])).toThrow(
      /Nothing to refund/,
    );
  });
});
