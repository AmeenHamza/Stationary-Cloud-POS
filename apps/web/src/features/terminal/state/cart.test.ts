import { describe, expect, it } from 'vitest';

import { MAX_LINES_PER_SALE, MAX_QUANTITY_PER_LINE } from '@pos/contracts';

import { cartReducer } from './cart.reducer';
import { restoreCart } from './cart.storage';
import { EMPTY_CART, type CartState } from './cart.types';

const P1 = '0192f0c1-0000-7000-8000-0000000000a1';
const P2 = '0192f0c1-0000-7000-8000-0000000000a2';

const run = (...actions: Parameters<typeof cartReducer>[1][]): CartState =>
  actions.reduce(cartReducer, EMPTY_CART);

describe('cart reducer (SYSTEM_DESIGN.md §3.1)', () => {
  it('merges a product added twice in the same unit and keeps units apart (F-19, F-33)', () => {
    const cart = run(
      { type: 'add', productId: P1, unit: 'PIECE' },
      { type: 'add', productId: P1, unit: 'PIECE' },
      { type: 'add', productId: P1, unit: 'BOX' },
    );
    expect(cart.lines).toEqual([
      { productId: P1, unit: 'PIECE', quantity: 2 },
      { productId: P1, unit: 'BOX', quantity: 1 },
    ]);
    expect(cart.customLines).toEqual([]);
    const merged = cartReducer(cart, {
      type: 'changeUnit',
      productId: P1,
      from: 'BOX',
      to: 'PIECE',
    });
    expect(merged.lines).toEqual([{ productId: P1, unit: 'PIECE', quantity: 3 }]);
  });

  it('clamps quantities, removes a line at zero and caps the number of lines (Q34)', () => {
    const big = run(
      { type: 'add', productId: P1, unit: 'PIECE' },
      { type: 'setQuantity', productId: P1, unit: 'PIECE', quantity: MAX_QUANTITY_PER_LINE + 5 },
    );
    expect(big.lines[0]?.quantity).toBe(MAX_QUANTITY_PER_LINE);
    expect(
      cartReducer(big, { type: 'setQuantity', productId: P1, unit: 'PIECE', quantity: 0 }).lines,
    ).toEqual([]);
    const full: CartState = {
      ...EMPTY_CART,
      lines: Array.from({ length: MAX_LINES_PER_SALE }, (_, index) => ({
        productId: `id-${String(index)}`,
        unit: 'PIECE' as const,
        quantity: 1,
      })),
    };
    expect(cartReducer(full, { type: 'add', productId: P2, unit: 'PIECE' }).lines).toHaveLength(
      MAX_LINES_PER_SALE,
    );
  });

  it('keeps the Udhaar customer only while Udhaar is chosen, and drops refused products', () => {
    const udhaar = run(
      { type: 'add', productId: P1, unit: 'PIECE' },
      { type: 'add', productId: P2, unit: 'BOX' },
      { type: 'setPaymentMethod', paymentMethod: 'UDHAAR' },
      { type: 'setCustomer', customer: { id: P2, name: 'Ali' } },
    );
    expect(udhaar.customer).toEqual({ id: P2, name: 'Ali' });
    expect(
      cartReducer(udhaar, { type: 'setPaymentMethod', paymentMethod: 'CASH' }).customer,
    ).toBeNull();
    expect(cartReducer(udhaar, { type: 'removeProducts', productIds: [P2] }).lines).toEqual([
      { productId: P1, unit: 'PIECE', quantity: 1 },
    ]);
    expect(cartReducer(udhaar, { type: 'clear' })).toBe(EMPTY_CART);
  });

  it('sets a discount on one line of a product, and it goes with the line (D-27)', () => {
    const discount = { type: 'FLAT' as const, amount: '5', percent: '' };
    const cart = run(
      { type: 'add', productId: P1, unit: 'PIECE' },
      { type: 'add', productId: P1, unit: 'BOX' },
      { type: 'setLineDiscount', productId: P1, unit: 'BOX', discount },
    );
    expect(cart.lines).toEqual([
      { productId: P1, unit: 'PIECE', quantity: 1 },
      { productId: P1, unit: 'BOX', quantity: 1, discount },
    ]);
    expect(cartReducer(cart, { type: 'remove', productId: P1, unit: 'BOX' }).lines).toEqual([
      { productId: P1, unit: 'PIECE', quantity: 1 },
    ]);
  });
});

describe('restoreCart (a saved cart from this browser)', () => {
  it('keeps well-formed lines and entries, drops the rest', () => {
    const restored = restoreCart({
      lines: [
        { productId: P1, unit: 'PIECE', quantity: 2 },
        { productId: 'not-a-uuid', unit: 'PIECE', quantity: 1 },
        { productId: P2, unit: 'CRATE', quantity: 1 },
      ],
      discount: { type: 'FLAT', amount: '50' },
      billGst: { applied: true, rate: '17' },
      paymentMethod: 'UDHAAR',
      customer: { id: P2, name: 'Ali' },
    });
    expect(restored).toEqual({
      lines: [{ productId: P1, unit: 'PIECE', quantity: 2 }],
      customLines: [],
      discount: { type: 'FLAT', amount: '50', percent: '' },
      billGst: { applied: true, rate: '17' },
      paymentMethod: 'UDHAAR',
      customer: { id: P2, name: 'Ali' },
    });
  });

  it('keeps item discounts, and a half-typed one never costs the line (D-27)', () => {
    const restored = restoreCart({
      lines: [
        { productId: P1, unit: 'PIECE', quantity: 2, discount: { type: 'FLAT', amount: '' } },
        { productId: P2, unit: 'PIECE', quantity: 1, discount: { type: 'NONE' } },
      ],
      customLines: [
        {
          name: 'Binding',
          unit: 'PIECE',
          quantity: 1,
          unitPrice: '100',
          taxRate: '0',
          discount: { type: 'PERCENT', percent: '1' },
        },
      ],
    });
    expect(restored.lines).toEqual([
      {
        productId: P1,
        unit: 'PIECE',
        quantity: 2,
        discount: { type: 'FLAT', amount: '', percent: '' },
      },
      { productId: P2, unit: 'PIECE', quantity: 1 },
    ]);
    expect(restored.customLines).toEqual([
      {
        id: 'custom-0',
        name: 'Binding',
        unit: 'PIECE',
        quantity: 1,
        unitPrice: '100',
        taxRate: '0',
        discount: { type: 'PERCENT', amount: '', percent: '1' },
      },
    ]);
  });

  it('falls back to an empty cart for anything else', () => {
    expect(restoreCart(null)).toBe(EMPTY_CART);
    expect(restoreCart({ lines: 'x' })).toBe(EMPTY_CART);
    expect(restoreCart({ lines: [], paymentMethod: 'BITCOIN', customer: { id: P1 } })).toEqual(
      EMPTY_CART,
    );
  });
});
