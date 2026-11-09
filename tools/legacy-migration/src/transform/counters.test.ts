import { describe, expect, it } from 'vitest';

import { Decimal } from '@pos/domain';

import { datedRefunds, planCounters } from './counters.js';
import { fingerprintOf } from './fingerprint.js';
import { Issues } from './issues.js';

import type { LedgerPlan } from './ledgers.js';
import type { RefundPlan } from './order-refund.js';
import type { OrderPlan } from './orders.js';
import type { MigrationPlan } from './plan.js';
import type { CustomerEntryType } from '@pos/contracts';

const order = (billNumber: string, businessDate: string, refund: RefundPlan | null = null) =>
  ({ id: `o-${billNumber}`, billNumber, businessDate, refund }) as OrderPlan;

describe('planCounters (MIG-05)', () => {
  it('takes the highest number of each date, in date order', () => {
    const counters = planCounters([
      order('ORD-20261031-002', '2026-10-31'),
      order('ORD-20261030-007', '2026-10-30'),
      order('ORD-20261031-010', '2026-10-31'),
    ]);
    expect(counters).toEqual([
      { businessDate: '2026-10-30', lastValue: 7 },
      { businessDate: '2026-10-31', lastValue: 10 },
    ]);
  });

  it('skips numbers in another format or dated on another day', () => {
    expect(
      planCounters([order('INV-77', '2026-10-30'), order('ORD-20261030-005', '2026-10-29')]),
    ).toEqual([]);
  });
});

describe('datedRefunds (Q43)', () => {
  const refund = {
    id: 'r-1',
    createdAt: new Date('2026-11-01T07:00:00Z'),
    businessDate: '2026-11-01',
  } as RefundPlan;
  const entry = (refundId: string | null) =>
    ({
      refundId,
      createdAt: new Date('2026-11-04T11:00:00Z'),
      businessDate: '2026-11-04',
    }) as LedgerPlan<CustomerEntryType>;

  it('dates a refund by its khata refund entry, the only date the old app kept', () => {
    const [dated] = datedRefunds([order('ORD-20261101-001', '2026-11-01', refund)], [entry('r-1')]);
    expect(dated?.refund).toMatchObject({
      businessDate: '2026-11-04',
      createdAt: new Date('2026-11-04T11:00:00Z'),
    });
  });

  it("keeps the bill's date when no khata entry belongs to the refund", () => {
    const [kept] = datedRefunds([order('ORD-20261101-001', '2026-11-01', refund)], [entry(null)]);
    expect(kept?.refund).toBe(refund);
  });
});

describe('fingerprintOf', () => {
  const plan = (stock: number) =>
    ({
      products: [{ id: 'p-1', stockPieces: stock, salePrice: new Decimal('20').toFixed(2) }],
      shopGstRate: new Decimal('18'),
      issues: new Issues(),
      read: { products: 1 },
    }) as unknown as MigrationPlan;

  it('is the same for the same plan and changes with any value', () => {
    expect(fingerprintOf(plan(5))).toMatch(/^[0-9a-f]{12}$/);
    expect(fingerprintOf(plan(5))).toBe(fingerprintOf(plan(5)));
    expect(fingerprintOf(plan(6))).not.toBe(fingerprintOf(plan(5)));
  });
});
