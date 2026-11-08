import { describe, expect, it } from 'vitest';

import { givesDiscount } from './create-sale.lines';

import type { CreateSaleInput } from '@pos/validation';

const LINE = { productId: 'p', unit: 'PIECE', quantity: 1 } as const;
const CUSTOM = { name: 'x', unit: 'PIECE', quantity: 1, unitPrice: '1', taxRate: '0' } as const;

const input = (fields: Partial<CreateSaleInput>): CreateSaleInput =>
  ({ lines: [LINE], discount: { type: 'NONE' }, ...fields }) as CreateSaleInput;

describe('givesDiscount (the sales:discount check, D-11, D-27)', () => {
  it('is false for a bill with no discount of any kind', () => {
    expect(givesDiscount(input({}))).toBe(false);
    expect(
      givesDiscount(input({ lines: [{ ...LINE, discount: { type: 'NONE' } }], customLines: null })),
    ).toBe(false);
  });

  it('sees an overall discount, or one on any line', () => {
    expect(givesDiscount(input({ discount: { type: 'FLAT', amount: '1' } }))).toBe(true);
    expect(
      givesDiscount(input({ lines: [{ ...LINE, discount: { type: 'FLAT', amount: '1' } }] })),
    ).toBe(true);
    expect(
      givesDiscount(
        input({ customLines: [{ ...CUSTOM, discount: { type: 'PERCENT', percent: '1' } }] }),
      ),
    ).toBe(true);
  });
});
