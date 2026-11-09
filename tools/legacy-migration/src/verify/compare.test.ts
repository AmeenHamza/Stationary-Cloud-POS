import { describe, expect, it } from 'vitest';

import { compareFacts, rowsReadCheck } from './compare.js';
import { COUNT_KEYS, GROUP_KEYS, RECORD_KEYS, TOTAL_KEYS, type Facts } from './facts.js';

import type { LegacyEntity } from '../legacy/schema-map.js';

function facts(): Facts {
  return {
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, 1])) as Facts['counts'],
    totals: Object.fromEntries(TOTAL_KEYS.map((key) => [key, '10.00'])) as Facts['totals'],
    groups: Object.fromEntries(
      GROUP_KEYS.map((key) => [key, new Map([['CASH', '10.00']])]),
    ) as Facts['groups'],
    records: Object.fromEntries(
      RECORD_KEYS.map((key) => [key, new Map([['1', { amount: '10.00', createdAt: null }]])]),
    ) as unknown as Facts['records'],
  };
}

const failed = (source: Facts, target: Facts) =>
  compareFacts(source, target).filter((check) => !check.passed);

describe('compareFacts', () => {
  it('passes when both sides agree', () => {
    expect(failed(facts(), facts())).toEqual([]);
  });

  it('fails a different count or total, naming both values', () => {
    const target = facts();
    target.counts.refunds = 2;
    target.totals.sales = '10.01';
    expect(failed(facts(), target).map((check) => `${check.name}: ${check.detail}`)).toEqual([
      'count: refunds: old 1, new 2',
      'total: sales: old 10.00, new 10.01',
    ]);
  });

  it('lists missing, different and extra records, and skips fields the old side does not know', () => {
    const source = facts();
    source.records.orders = new Map([
      ['1', { total: '5.00', createdAt: null }],
      ['2', { total: '7.00', createdAt: '2026-10-30T05:00:00.000Z' }],
    ]);
    const target = facts();
    target.records.orders = new Map([
      ['1', { total: '5.00', createdAt: '2026-11-09T00:00:00.000Z' }],
      ['3', { total: '1.00', createdAt: null }],
    ]);
    const [check] = failed(source, target);
    expect(check).toMatchObject({
      name: 'records: orders',
      critical: true,
      detail: '2 old, 2 new; missing 1, different 0, extra 1',
      samples: ['#2 missing', '#3 not in the old data'],
    });
  });

  it('reports a payment-method split without failing the run', () => {
    const target = facts();
    target.groups.billPaymentsByMethod = new Map([['CARD', '10.00']]);
    const [check] = failed(facts(), target);
    expect(check).toMatchObject({ name: 'by group: billPaymentsByMethod', critical: false });
    expect(check?.samples).toEqual(['CARD: old none, new 10.00', 'CASH: old 10.00, new none']);
  });
});

describe('rowsReadCheck', () => {
  it('fails when the reader got fewer rows than the table holds', () => {
    const counted = { orders: 3, products: 2 } as Record<LegacyEntity, number>;
    expect(rowsReadCheck(counted, counted).passed).toBe(true);
    const short = rowsReadCheck({ ...counted, orders: 2 }, counted);
    expect(short).toMatchObject({
      passed: false,
      critical: true,
      samples: ['orders: read 2 of 3'],
    });
  });
});
