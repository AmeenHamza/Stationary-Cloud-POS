import { describe, expect, it } from 'vitest';

import { Decimal } from '@pos/domain';

import { Issues } from './issues.js';
import { billGstOf, discountTermsOf, statusOf } from './order-terms.js';

import type { LegacyRow } from '../legacy/schema-map.js';

const REF = 'orders#1';
const ZERO = new Decimal(0);

/** Only the columns a test sets are read; a missing one behaves like an empty column. */
function order(fields: Partial<LegacyRow<'orders'>>): LegacyRow<'orders'> {
  return fields as LegacyRow<'orders'>;
}

function discount(fields: Partial<LegacyRow<'orders'>>, discountTotal: Decimal, issues: Issues) {
  const terms = discountTermsOf(order(fields), discountTotal, issues, REF);
  return { type: terms.type, value: terms.value.toFixed(2) };
}

describe('discountTermsOf', () => {
  it('keeps a percentage from 0 to 100', () => {
    const issues = new Issues();
    const fields = { discountType: 'Percentage', discountValue: '10' };
    expect(discount(fields, ZERO, issues)).toEqual({ type: 'PERCENT', value: '10.00' });
    expect(issues.list).toEqual([]);
  });

  it('blocks a percentage above 100', () => {
    const issues = new Issues();
    discount({ discountType: 'percent', discountValue: '150' }, ZERO, issues);
    expect(issues.blocking).toBe(1);
  });

  it('keeps a flat amount', () => {
    const fields = { discountType: 'flat', discountValue: '20' };
    expect(discount(fields, ZERO, new Issues())).toEqual({ type: 'FLAT', value: '20.00' });
  });

  it('treats a discount without a type as a flat amount', () => {
    expect(discount({}, new Decimal(5), new Issues())).toEqual({ type: 'FLAT', value: '5.00' });
  });

  it('gives no discount when there is neither a type nor a discount', () => {
    expect(discount({}, ZERO, new Issues())).toEqual({ type: 'NONE', value: '0.00' });
  });
});

describe('billGstOf', () => {
  const empty = { billGstApplied: null, billGstAmount: null, billGstPercentage: null };

  it('gives no GST when it is neither flagged nor charged', () => {
    const gst = billGstOf(order(empty), new Decimal(18), new Issues(), REF);
    expect(gst.rate).toBeNull();
    expect(gst.amount.isZero()).toBe(true);
  });

  it('uses the shop rate for a charge without its own rate', () => {
    const issues = new Issues();
    const row = order({ ...empty, billGstApplied: 'true', billGstAmount: '18' });
    const gst = billGstOf(row, new Decimal(18), issues, REF);
    expect(gst.rate?.toString()).toBe('18');
    expect(gst.amount.toFixed(2)).toBe('18.00');
    expect(issues.list).toEqual([]);
  });

  it('prefers the rate on the bill', () => {
    const row = order({ ...empty, billGstAmount: '5', billGstPercentage: '5' });
    expect(billGstOf(row, new Decimal(18), new Issues(), REF).rate?.toString()).toBe('5');
  });

  it('blocks a charge with no rate anywhere', () => {
    const issues = new Issues();
    billGstOf(order({ ...empty, billGstAmount: '18' }), null, issues, REF);
    expect(issues.blocking).toBe(1);
  });
});

describe('statusOf', () => {
  const total = new Decimal(100);

  it('follows the refunded amount', () => {
    const issues = new Issues();
    expect(statusOf('completed', ZERO, total, issues, REF)).toBe('COMPLETED');
    expect(statusOf('refunded', total, total, issues, REF)).toBe('REFUNDED');
    expect(statusOf('partially_refunded', new Decimal(40), total, issues, REF)).toBe(
      'PARTIALLY_REFUNDED',
    );
    expect(issues.list).toEqual([]);
  });

  it('reads an empty old status as completed', () => {
    const issues = new Issues();
    expect(statusOf(null, ZERO, total, issues, REF)).toBe('COMPLETED');
    expect(issues.list).toEqual([]);
  });

  it('reports an old status that disagrees, without blocking', () => {
    const issues = new Issues();
    expect(statusOf('completed', new Decimal(40), total, issues, REF)).toBe('PARTIALLY_REFUNDED');
    expect(issues.blocking).toBe(0);
    expect(issues.list[0]?.kind).toBe('status-differs');
  });

  it('blocks a status it does not know', () => {
    const issues = new Issues();
    statusOf('cancelled', ZERO, total, issues, REF);
    expect(issues.blocking).toBe(1);
    expect(issues.list[0]?.kind).toBe('invalid-value');
  });
});
