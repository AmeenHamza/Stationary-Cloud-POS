import { describe, expect, it } from 'vitest';

import { DomainRuleError } from '../errors.js';

import { billDiscountOf, billGstOf, lineDiscountOf } from './bill-inputs.js';

describe('lineDiscountOf (one item, D-27)', () => {
  it('reads no entry as no discount and parses the value matching the type', () => {
    expect(lineDiscountOf(null)).toEqual({ type: 'NONE' });
    expect(lineDiscountOf(undefined)).toEqual({ type: 'NONE' });
    expect(lineDiscountOf({ type: 'NONE' })).toEqual({ type: 'NONE' });
    const flat = lineDiscountOf({ type: 'FLAT', amount: '50' });
    expect(flat.type === 'FLAT' && flat.amount.toString()).toBe('50');
    const percentage = lineDiscountOf({ type: 'PERCENT', percent: '10' });
    expect(percentage.type === 'PERCENT' && percentage.percent.toString()).toBe('10');
  });

  it('names the item discount when the value is missing', () => {
    expect(() => lineDiscountOf({ type: 'FLAT' })).toThrow(/^Item discount/);
    expect(() => lineDiscountOf({ type: 'PERCENT', percent: '' })).toThrow(/^Item discount/);
  });
});

describe('bill entries (shared by the API and the cart preview)', () => {
  it('reads the value that matches the discount type', () => {
    expect(billDiscountOf({ type: 'NONE', amount: 'ignored' })).toEqual({ type: 'NONE' });
    const flat = billDiscountOf({ type: 'FLAT', amount: '40.50', percent: null });
    expect(flat.type === 'FLAT' && flat.amount.toFixed(2)).toBe('40.50');
    const pct = billDiscountOf({ type: 'PERCENT', percent: '12.5' });
    expect(pct.type === 'PERCENT' && pct.percent.toString()).toBe('12.5');
  });

  it('refuses a missing or malformed value instead of guessing zero', () => {
    expect(() => billDiscountOf({ type: 'FLAT' })).toThrow(DomainRuleError);
    expect(() => billDiscountOf({ type: 'FLAT', amount: '1.005' })).toThrow(DomainRuleError);
    expect(() => billDiscountOf({ type: 'PERCENT', percent: '101' })).toThrow(DomainRuleError);
    expect(() => billDiscountOf({ type: 'PERCENT', percent: null })).toThrow(DomainRuleError);
  });

  it('reads Bill GST only when applied (D-25)', () => {
    expect(billGstOf({ applied: false, rate: 'x' })).toEqual({ applied: false });
    const applied = billGstOf({ applied: true, rate: '18' });
    expect(applied.applied && applied.rate.toString()).toBe('18');
    expect(() => billGstOf({ applied: true })).toThrow(DomainRuleError);
  });
});
