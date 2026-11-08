import { describe, expect, it } from 'vitest';

import { Decimal } from '../money/decimal.js';
import { toMoneyString as text } from '../money/money.js';

import { calculateBill } from './calculate-bill.js';

import type { BillDiscount, BillGst, BillLineInput } from './bill.types.js';

const NONE: BillDiscount = { type: 'NONE' };
const NO_GST: BillGst = { applied: false };
const d = (value: string): Decimal => new Decimal(value);
const percent = (value: string): BillDiscount => ({ type: 'PERCENT', percent: d(value) });
const flat = (value: string): BillDiscount => ({ type: 'FLAT', amount: d(value) });
const gst = (rate: string): BillGst => ({ applied: true, rate: d(rate) });

/** One line with its own discount; quantity and product tax only where a test needs them. */
const item = (
  price: string,
  discount: BillDiscount = NONE,
  quantity = 1,
  tax = '0',
): BillLineInput => ({
  unitPrice: d(price),
  quantity,
  taxRate: d(tax),
  discount,
});

describe('calculateBill — item discounts (D-27)', () => {
  it('FIN-25: discounts one item and leaves the others at full price', () => {
    const result = calculateBill([item('1000', percent('10')), item('500')], NONE, NO_GST);
    expect(text(result.subtotal)).toBe('1500.00');
    expect(text(result.discountTotal)).toBe('100.00');
    expect(text(result.total)).toBe('1400.00');
    expect(result.lines.map((l) => text(l.itemDiscount))).toEqual(['100.00', '0.00']);
    expect(result.lines.map((l) => text(l.lineNet))).toEqual(['900.00', '500.00']);
  });

  it('FIN-26: the overall discount applies to what is left after item discounts', () => {
    const lines = [item('1000', percent('10')), item('500')];
    const result = calculateBill(lines, percent('10'), NO_GST);
    // 1,500 - 100 item = 1,400; 10 % of 1,400 = 140 spread 90 / 50.
    expect(text(result.itemDiscountTotal)).toBe('100.00');
    expect(text(result.billDiscountTotal)).toBe('140.00');
    expect(text(result.discountTotal)).toBe('240.00');
    expect(result.lines.map((l) => text(l.lineDiscount))).toEqual(['190.00', '50.00']);
    expect(text(result.total)).toBe('1260.00');
  });

  it('FIN-27: a flat item discount comes off the whole line, before product tax and GST', () => {
    const result = calculateBill([item('100', flat('50'), 3, '10')], NONE, gst('18'));
    // 300 - 50 = 250; tax 25; GST 18 % of 275 = 49.50.
    expect(text(result.discountTotal)).toBe('50.00');
    expect(text(result.productTaxTotal)).toBe('25.00');
    expect(text(result.billGstAmount)).toBe('49.50');
    expect(text(result.total)).toBe('324.50');
  });

  it('FIN-28: refuses a discount above the item, or a percentage above 100', () => {
    expect(() => calculateBill([item('50', flat('50.01'))], NONE, NO_GST)).toThrow(
      /Item discount must be between 0 and the item/,
    );
    expect(() => calculateBill([item('50', percent('101'))], NONE, NO_GST)).toThrow(
      /Item discount percentage/,
    );
  });

  it('FIN-29: limits a flat overall discount to what item discounts left', () => {
    const lines = [item('100', flat('60'))];
    expect(text(calculateBill(lines, flat('40'), NO_GST).total)).toBe('0.00');
    expect(() => calculateBill(lines, flat('40.01'), NO_GST)).toThrow(/Flat discount/);
  });

  it('FIN-30: a fully discounted bill allocates nothing and totals zero', () => {
    const result = calculateBill([item('80', percent('100'))], percent('50'), gst('18'));
    expect(text(result.discountTotal)).toBe('80.00');
    expect(text(result.billGstAmount)).toBe('0.00');
    expect(text(result.total)).toBe('0.00');
  });

  it('keeps every line and the total consistent for mixed discounts (DB CHECKs)', () => {
    const lines = [
      item('19.99', percent('7.5'), 1, '17'),
      item('7.45', flat('0.45'), 1, '5'),
      item('33.33', NONE, 3, '18'),
    ];
    const result = calculateBill(lines, percent('12.5'), gst('16'));
    for (const l of result.lines) {
      expect(l.lineNet.equals(l.lineGross.minus(l.lineDiscount))).toBe(true);
      expect(l.itemDiscount.lessThanOrEqualTo(l.lineDiscount)).toBe(true);
    }
    const sumOf = (pick: (l: (typeof result.lines)[number]) => Decimal) =>
      result.lines.reduce((total, l) => total.plus(pick(l)), d('0'));
    expect(sumOf((l) => l.lineDiscount).equals(result.discountTotal)).toBe(true);
    expect(sumOf((l) => l.itemDiscount).equals(result.itemDiscountTotal)).toBe(true);
    expect(
      result.total.equals(
        result.subtotal
          .minus(result.discountTotal)
          .plus(result.productTaxTotal)
          .plus(result.billGstAmount),
      ),
    ).toBe(true);
  });
});
