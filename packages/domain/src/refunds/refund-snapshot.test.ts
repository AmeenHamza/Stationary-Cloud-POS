import { describe, expect, it } from 'vitest';

import { DomainRuleError } from '../errors.js';
import { toMoneyString } from '../money/money.js';

import { calculateRefund } from './calculate-refund.js';
import { refundSnapshotOf } from './refund-snapshot.js';

describe('refundSnapshotOf (API rows and the refund dialog share it)', () => {
  const stored = {
    lines: [
      {
        id: '7',
        quantity: 2,
        refundedQuantity: 1,
        lineNet: '100.00',
        lineTax: '10.00',
        refundedAmount: '55.00',
      },
    ],
    billGstAmount: '19.80',
    refundedGstShare: '9.90',
  };

  it('parses served money strings and refunds the exact remainder', () => {
    const result = calculateRefund(refundSnapshotOf(stored), [{ lineId: '7', quantity: 1 }]);
    expect(toMoneyString(result.amount)).toBe('64.90');
    expect(result.completesOrder).toBe(true);
  });

  it('refuses malformed amounts', () => {
    expect(() => refundSnapshotOf({ ...stored, billGstAmount: '1e3' })).toThrow(DomainRuleError);
  });
});
