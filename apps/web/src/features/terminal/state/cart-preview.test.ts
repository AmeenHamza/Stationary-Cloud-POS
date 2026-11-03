import { describe, expect, it } from 'vitest';

import { toMoneyString } from '@pos/domain';

import { previewCart } from './cart-preview';
import { EMPTY_CART, type CartState } from './cart.types';
import { saleInputOf } from './sale-input';

import type { SaleProductFieldsFragment as SaleProduct } from '@/graphql/__generated__/graphql';

const product = (id: string, fields: Partial<SaleProduct> = {}): SaleProduct => ({
  id,
  name: `Item ${id}`,
  nameUrdu: null,
  baseUnitLabel: 'Piece',
  piecesPerBox: 12,
  salePrice: '120.00',
  boxPrice: null,
  taxRate: '0.00',
  stockPieces: 100,
  isLowStock: false,
  archivedAt: null,
  version: 1,
  ...fields,
});

const catalogue = new Map([
  ['a', product('a')],
  ['b', product('b', { salePrice: '70.00' })],
  ['c', product('c', { salePrice: '50.00', boxPrice: '540.00', stockPieces: 13 })],
]);

const cart = (fields: Partial<CartState>): CartState => ({ ...EMPTY_CART, ...fields });

describe('cart preview (the same calculateBill as the API, ADR-013)', () => {
  it('FIN-01 at the counter: 120 + 70 + 50 with 18 % Bill GST shows 283.20', () => {
    const preview = previewCart(
      cart({
        lines: ['a', 'b', 'c'].map((productId) => ({ productId, unit: 'PIECE', quantity: 1 })),
        billGst: { applied: true, rate: null },
      }),
      catalogue,
      '18',
    );
    expect(preview.bill && toMoneyString(preview.bill.total)).toBe('283.20');
    expect(preview.itemCount).toBe(3);
  });

  it('prices boxes at the box price and warns above stock across units (D-16, D-17)', () => {
    const preview = previewCart(
      cart({
        lines: [
          { productId: 'c', unit: 'BOX', quantity: 1 },
          { productId: 'c', unit: 'PIECE', quantity: 2 },
        ],
      }),
      catalogue,
      '18',
    );
    expect(preview.lines.map((line) => line.lineGross && toMoneyString(line.lineGross))).toEqual([
      '540.00',
      '100.00',
    ]);
    expect(preview.lines.every((line) => line.aboveStock)).toBe(true); // 14 pieces > 13 in stock
  });

  it('withholds a total while a line is loading or unsellable, or an entry is invalid', () => {
    const lines = [{ productId: 'a', unit: 'BOX' as const, quantity: 1 }];
    expect(previewCart(cart({ lines }), catalogue, '18')).toMatchObject({
      bill: null,
      priced: false,
    });
    const loading = [{ productId: 'zz', unit: 'PIECE' as const, quantity: 1 }];
    expect(previewCart(cart({ lines: loading }), catalogue, '18').priced).toBe(false);
    const flat = previewCart(
      cart({
        lines: [{ productId: 'b', unit: 'PIECE', quantity: 1 }],
        discount: { type: 'FLAT', amount: '80', percent: '' },
      }),
      catalogue,
      '18',
    );
    expect(flat.bill).toBeNull();
    expect(flat.entryError).toMatch(/between 0 and the subtotal/);
  });
});

describe('saleInputOf (the createSale input)', () => {
  const lines = [{ productId: 'a', unit: 'PIECE' as const, quantity: 2 }];

  it('sends lines without prices, the entries as typed and the previewed total', () => {
    const state = cart({
      lines,
      discount: { type: 'PERCENT', amount: '9', percent: '10' },
      billGst: { applied: true, rate: null },
    });
    const preview = { ...previewCart(state, catalogue, '18'), gstRate: '18' };
    expect(saleInputOf(state, preview, 'key-1')).toEqual({
      idempotencyKey: 'key-1',
      lines,
      customLines: [],
      discount: { type: 'PERCENT', percent: '10' },
      billGst: { applied: true, rate: '18' },
      paymentMethod: 'CASH',
      customerId: null,
      expectedTotal: '254.88',
    });
  });

  it('needs a customer for Udhaar (D-15)', () => {
    const state = cart({ lines, paymentMethod: 'UDHAAR' });
    const preview = { ...previewCart(state, catalogue, '18'), gstRate: '18' };
    expect(saleInputOf(state, preview, 'k')).toBeNull();
    const chosen = { ...state, customer: { id: 'cust', name: 'Ali' } };
    expect(saleInputOf(chosen, preview, 'k')?.customerId).toBe('cust');
  });

  it('sends custom lines with integer prices and a fallback name', () => {
    const state = cart({
      lines: [],
      customLines: [
        { id: 'c1', name: '  ', unit: 'PIECE', quantity: 2, unitPrice: '890', taxRate: '0' },
      ],
    });
    const preview = { ...previewCart(state, catalogue, '18'), gstRate: '18' };
    expect(saleInputOf(state, preview, 'key-2')?.customLines).toEqual([
      { name: 'Custom item', unit: 'PIECE', quantity: 2, unitPrice: '890', taxRate: '0' },
    ]);
  });
});
