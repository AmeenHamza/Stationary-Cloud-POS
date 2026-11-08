import { describe, expect, it } from 'vitest';

import { toMoneyString } from '@pos/domain';

import { previewCart } from './cart-preview';
import { EMPTY_CART, type CartState } from './cart.types';
import { saleInputOf } from './sale-input';

import type { SaleProductFieldsFragment as SaleProduct } from '@/graphql/__generated__/graphql';

const product = (id: string, salePrice: string): SaleProduct => ({
  id,
  name: `Item ${id}`,
  nameUrdu: null,
  baseUnitLabel: 'Piece',
  piecesPerBox: 12,
  salePrice,
  boxPrice: null,
  taxRate: '0.00',
  stockPieces: 100,
  isLowStock: false,
  archivedAt: null,
  version: 1,
});

const catalogue = new Map([
  ['a', product('a', '120.00')],
  ['b', product('b', '70.00')],
]);

const cart = (fields: Partial<CartState>): CartState => ({ ...EMPTY_CART, ...fields });

const BINDING = {
  id: 'c1',
  name: 'Binding',
  unit: 'PIECE' as const,
  quantity: 2,
  unitPrice: '100',
  taxRate: '0',
};

describe('item discounts in the cart preview (the same calculateBill as the API, D-27)', () => {
  it('takes an item discount from that line alone, then the overall one (FIN-26)', () => {
    const preview = previewCart(
      cart({
        lines: [
          {
            productId: 'a',
            unit: 'PIECE',
            quantity: 1,
            discount: { type: 'PERCENT', amount: '', percent: '50' },
          },
          { productId: 'b', unit: 'PIECE', quantity: 1 },
        ],
        discount: { type: 'FLAT', amount: '13', percent: '' },
      }),
      catalogue,
      '18',
    );
    // 120 - 60 item = 60, plus 70 = 130; flat 13 overall leaves 117.
    expect(preview.bill && toMoneyString(preview.bill.itemDiscountTotal)).toBe('60.00');
    expect(preview.bill && toMoneyString(preview.bill.billDiscountTotal)).toBe('13.00');
    expect(preview.bill && toMoneyString(preview.bill.total)).toBe('117.00');
  });

  it('withholds the total for an item discount that is blank or above the item', () => {
    const withDiscount = (amount: string) =>
      previewCart(
        cart({
          lines: [
            {
              productId: 'a',
              unit: 'PIECE',
              quantity: 1,
              discount: { type: 'FLAT', amount, percent: '' },
            },
          ],
        }),
        catalogue,
        '18',
      );
    expect(withDiscount('').bill).toBeNull();
    expect(withDiscount('').entryError).toMatch(/^Item discount/);
    expect(withDiscount('120.01').entryError).toMatch(/Item discount must be between 0/);
    const free = withDiscount('120').bill;
    expect(free && toMoneyString(free.total)).toBe('0.00');
  });

  it('gives custom lines item discounts too', () => {
    const preview = previewCart(
      cart({
        customLines: [{ ...BINDING, discount: { type: 'FLAT', amount: '30', percent: '' } }],
      }),
      catalogue,
      '18',
    );
    expect(preview.bill && toMoneyString(preview.bill.total)).toBe('170.00');
  });
});

describe('item discounts in the createSale input (D-27)', () => {
  it('sends only real item discounts, as typed', () => {
    const state = cart({
      lines: [
        {
          productId: 'a',
          unit: 'PIECE',
          quantity: 1,
          discount: { type: 'PERCENT', amount: '9', percent: '10' },
        },
        {
          productId: 'b',
          unit: 'PIECE',
          quantity: 1,
          discount: { type: 'NONE', amount: '5', percent: '' },
        },
      ],
      customLines: [
        { ...BINDING, quantity: 1, discount: { type: 'FLAT', amount: '30', percent: '' } },
      ],
    });
    const preview = { ...previewCart(state, catalogue, '18'), gstRate: '18' };
    const input = saleInputOf(state, preview, 'key-3');
    expect(input?.lines).toEqual([
      { productId: 'a', unit: 'PIECE', quantity: 1, discount: { type: 'PERCENT', percent: '10' } },
      { productId: 'b', unit: 'PIECE', quantity: 1 },
    ]);
    expect(input?.customLines?.[0]?.discount).toEqual({ type: 'FLAT', amount: '30' });
    expect(input?.expectedTotal).toBe('248.00'); // 120 - 12 + 70 + 100 - 30
  });
});
