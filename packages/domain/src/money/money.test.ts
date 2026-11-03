import { describe, expect, it } from 'vitest';

import { allocate } from './allocate.js';
import { Decimal } from './decimal.js';
import { formatRs } from './format.js';
import {
  isMoneyString,
  isPercentString,
  money,
  percent,
  percentOf,
  round2,
  sum,
  toMoneyString,
} from './money.js';

const d = (value: string): Decimal => new Decimal(value);

describe('money parsing', () => {
  it.each(['0', '1', '1.5', '1.50', '9999999999.99', '-12.30'])('accepts %s', (value) => {
    expect(isMoneyString(value)).toBe(true);
    expect(money(value).toString()).toBe(new Decimal(value).toString());
  });

  it.each(['', '1.234', '1e3', 'abc', '12345678901', '.5'])('rejects %s', (value) => {
    expect(() => money(value, 'price')).toThrow(/price must be an amount/);
  });

  it('recognises Percent wire values (0–100, at most 2 decimals)', () => {
    expect(['0', '18', '18.5', '100', '100.00'].every(isPercentString)).toBe(true);
    expect(['100.01', '101', '-1', '12.345', '', 'abc'].some(isPercentString)).toBe(false);
  });

  it('passes Decimals through and parses percentages', () => {
    const value = d('3.14');
    expect(money(value)).toBe(value);
    expect(percent('18').toString()).toBe('18');
    expect(percent(d('0')).toString()).toBe('0');
    expect(() => percent('100.01')).toThrow(/between 0 and 100/);
    expect(() => percent('abc')).toThrow(/between 0 and 100/);
    expect(() => percent(d('-1'))).toThrow(/between 0 and 100/);
  });
});

describe('rounding and formatting', () => {
  it('rounds half-up to the paisa (A-02)', () => {
    expect(round2(d('0.005')).toString()).toBe('0.01');
    expect(round2(d('0.0049')).toString()).toBe('0');
    expect(round2(d('2.675')).toString()).toBe('2.68');
    expect(percentOf(d('240'), d('18')).toString()).toBe('43.2');
  });

  it('serializes money with exactly two decimals', () => {
    expect(toMoneyString(d('283.2'))).toBe('283.20');
    expect(toMoneyString(d('0'))).toBe('0.00');
    expect(sum([d('1.1'), d('2.2')]).toString()).toBe('3.3');
    expect(sum([]).toString()).toBe('0');
  });

  it('formats Rs with thousands separators and two decimals (R14)', () => {
    expect(formatRs('1063816353')).toBe('Rs 1,063,816,353.00');
    expect(formatRs(d('283.2'))).toBe('Rs 283.20');
    expect(formatRs('-400')).toBe('-Rs 400.00');
    expect(formatRs('0.5')).toBe('Rs 0.50');
  });
});

describe('allocate (largest remainder, A-01)', () => {
  const shares = (total: string, weights: string[]): string[] =>
    allocate(d(total), weights.map(d), (w) => w).map((a) => a.share.toFixed(2));

  it('splits exactly and gives ties to the earlier item', () => {
    expect(shares('10', ['33.33', '33.33', '33.34'])).toEqual(['3.33', '3.33', '3.34']);
    expect(shares('0.01', ['1', '1', '1'])).toEqual(['0.01', '0.00', '0.00']);
    expect(shares('0.02', ['1', '1', '1'])).toEqual(['0.01', '0.01', '0.00']);
  });

  it('always sums to the total', () => {
    const weights = ['17.31', '4.99', '0.01', '250', '3.33'];
    const parts = allocate(d('37.77'), weights.map(d), (w) => w).map((a) => a.share);
    expect(sum(parts).toString()).toBe('37.77');
  });

  it('handles zero weights and rejects impossible inputs', () => {
    expect(shares('0', ['0', '0'])).toEqual(['0.00', '0.00']);
    expect(() => allocate(d('1'), [d('0')], (w) => w)).toThrow(/zero weight/);
    expect(() => allocate(d('-1'), [d('1')], (w) => w)).toThrow(/negative/);
    expect(() => allocate(d('1'), [d('-1')], (w) => w)).toThrow(/negative/);
  });
});
