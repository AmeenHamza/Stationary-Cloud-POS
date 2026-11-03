import { describe, expect, it } from 'vitest';

import { Decimal } from '../money/decimal.js';
import { toMoneyString } from '../money/money.js';

import { calculateBill } from './calculate-bill.js';

import type { BillDiscount, BillGst, BillLineInput } from './bill.types.js';

const d = (value: string): Decimal => new Decimal(value);
const line = (price: string, quantity = 1, tax = '0'): BillLineInput => ({
  unitPrice: d(price),
  quantity,
  taxRate: d(tax),
});
const NONE: BillDiscount = { type: 'NONE' };
const NO_GST: BillGst = { applied: false };
const gst = (rate: string): BillGst => ({ applied: true, rate: d(rate) });

function totals(result: ReturnType<typeof calculateBill>) {
  return {
    subtotal: toMoneyString(result.subtotal),
    discount: toMoneyString(result.discountTotal),
    productTax: toMoneyString(result.productTaxTotal),
    gst: toMoneyString(result.billGstAmount),
    total: toMoneyString(result.total),
  };
}

describe('calculateBill — TESTING.md FIN cases', () => {
  it('FIN-01: screenshot #44 — 120 + 70 + 50 with 18 % Bill GST is 283.20', () => {
    const result = calculateBill([line('120'), line('70'), line('50')], NONE, gst('18'));
    expect(totals(result)).toEqual({
      subtotal: '240.00',
      discount: '0.00',
      productTax: '0.00',
      gst: '43.20',
      total: '283.20',
    });
  });

  it('FIN-02: D-25 — Bill GST is charged on items plus product tax (1,298.00)', () => {
    const result = calculateBill([line('1000', 1, '10')], NONE, gst('18'));
    expect(totals(result)).toMatchObject({ productTax: '100.00', gst: '198.00', total: '1298.00' });
  });

  it('FIN-03: D-08 — discount first, then tax (1,062.00)', () => {
    const result = calculateBill([line('1000')], { type: 'PERCENT', percent: d('10') }, gst('18'));
    expect(totals(result)).toMatchObject({ discount: '100.00', gst: '162.00', total: '1062.00' });
  });

  it('FIN-04: a flat discount is allocated to lines and sums exactly', () => {
    const lines = [line('33.33'), line('33.33'), line('33.34')];
    const result = calculateBill(lines, { type: 'FLAT', amount: d('10') }, NO_GST);
    const shares = result.lines.map((l) => toMoneyString(l.lineDiscount));
    expect(shares).toEqual(['3.33', '3.33', '3.34']);
    expect(toMoneyString(result.total)).toBe('90.00');
  });

  it('FIN-05: percentages round half-up to the paisa (12.5 % of 0.20 = 0.03)', () => {
    const result = calculateBill([line('0.20')], { type: 'PERCENT', percent: d('12.5') }, NO_GST);
    expect(toMoneyString(result.discountTotal)).toBe('0.03');
    expect(toMoneyString(result.total)).toBe('0.17');
  });

  it('FIN-06: a box line uses the box price as unit price', () => {
    const result = calculateBill([line('1000', 2)], NONE, NO_GST);
    expect(toMoneyString(result.lines[0]?.lineGross ?? d('0'))).toBe('2000.00');
  });

  it('FIN-07: rejects a flat discount above the subtotal and percentages above 100', () => {
    expect(() =>
      calculateBill([line('100')], { type: 'FLAT', amount: d('100.01') }, NO_GST),
    ).toThrow(/Flat discount/);
    expect(() =>
      calculateBill([line('100')], { type: 'PERCENT', percent: d('100.5') }, NO_GST),
    ).toThrow(/percentage/);
    expect(() => calculateBill([line('100', 1, '101')], NONE, NO_GST)).toThrow(/Tax rate/);
    expect(() => calculateBill([line('100')], NONE, gst('-1'))).toThrow(/Tax rate/);
  });
});

describe('calculateBill — combined rules', () => {
  it('applies discount, per-line product tax and Bill GST together', () => {
    const lines = [line('100', 2, '10'), line('50', 1, '0')];
    const result = calculateBill(lines, { type: 'FLAT', amount: d('25') }, gst('18'));
    // gross 200 + 50; discount 20 + 5; tax 18 on 180; GST 18 % of (225 + 18) = 43.74
    expect(totals(result)).toEqual({
      subtotal: '250.00',
      discount: '25.00',
      productTax: '18.00',
      gst: '43.74',
      total: '286.74',
    });
    expect(result.billGstRate?.toString()).toBe('18');
  });

  it('keeps the total equal to its components (the DB CHECK in DATABASE.md §4.10)', () => {
    const lines = [line('19.99', 3, '17'), line('7.45', 7, '5'), line('0.01', 1, '18')];
    const result = calculateBill(lines, { type: 'PERCENT', percent: d('7.5') }, gst('16'));
    const recomposed = result.subtotal
      .minus(result.discountTotal)
      .plus(result.productTaxTotal)
      .plus(result.billGstAmount);
    expect(result.total.equals(recomposed)).toBe(true);
    expect(result.billGstRate).not.toBeNull();
  });

  it('allows a 100 % discount', () => {
    const result = calculateBill([line('80')], { type: 'PERCENT', percent: d('100') }, gst('18'));
    expect(toMoneyString(result.total)).toBe('0.00');
  });

  it('rejects empty bills, too many lines and invalid quantities', () => {
    expect(() => calculateBill([], NONE, NO_GST)).toThrow(/1 to 100 lines/);
    expect(() =>
      calculateBill(
        Array.from({ length: 101 }, () => line('1')),
        NONE,
        NO_GST,
      ),
    ).toThrow();
    expect(() => calculateBill([line('1', 0)], NONE, NO_GST)).toThrow(/valid quantity/);
    expect(() => calculateBill([line('1', 1.5)], NONE, NO_GST)).toThrow(/valid quantity/);
    expect(() => calculateBill([line('-1')], NONE, NO_GST)).toThrow(/valid quantity/);
  });
});
