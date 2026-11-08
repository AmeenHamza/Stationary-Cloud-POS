import { describe, expect, it } from 'vitest';

import {
  createSaleInputSchema,
  ordersArgsSchema,
  refundOrderInputSchema,
} from './sales.schemas.js';

const KEY = '0192f0c1-0000-7000-8000-000000000001';
const P1 = '0192f0c1-0000-7000-8000-0000000000a1';

const sale = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: KEY,
  lines: [{ productId: P1, unit: 'PIECE', quantity: 2 }],
  customLines: [],
  discount: { type: 'NONE' },
  billGst: { applied: true, rate: '18' },
  paymentMethod: 'CASH',
  expectedTotal: '283.20',
  ...overrides,
});

describe('sale inputs (API.md §10.2)', () => {
  it('accepts the screenshot bill and normalizes the optional customer', () => {
    expect(createSaleInputSchema.parse(sale())).toMatchObject({ customerId: null });
  });

  it('takes a discount per line, with the value its type needs (D-27)', () => {
    const line = (discount: unknown) => [{ productId: P1, unit: 'PIECE', quantity: 1, discount }];
    const ok = (discount: unknown) =>
      createSaleInputSchema.safeParse(sale({ lines: line(discount) })).success;
    expect(ok({ type: 'FLAT', amount: '50' })).toBe(true);
    expect(ok({ type: 'PERCENT', percent: '12.5' })).toBe(true);
    expect(ok({ type: 'NONE' })).toBe(true);
    expect(ok(null)).toBe(true);
    expect(ok({ type: 'FLAT' })).toBe(false);
    expect(ok({ type: 'PERCENT', percent: '101' })).toBe(false);
    expect(ok({ type: 'FLAT', amount: '1.234' })).toBe(false);
    const custom = {
      name: 'Binding',
      unit: 'PIECE',
      quantity: 1,
      unitPrice: '100',
      taxRate: '0',
      discount: { type: 'FLAT' },
    };
    expect(
      createSaleInputSchema.safeParse(sale({ lines: [], customLines: [custom] })).success,
    ).toBe(false);
  });

  it('refuses empty or duplicate lines, bad quantities and incomplete discounts or GST', () => {
    const fails = (overrides: Record<string, unknown>) =>
      createSaleInputSchema.safeParse(sale(overrides)).success;
    expect(fails({ lines: [] })).toBe(false);
    expect(
      fails({
        lines: [
          { productId: P1, unit: 'PIECE', quantity: 1 },
          { productId: P1, unit: 'PIECE', quantity: 2 },
        ],
      }),
    ).toBe(false);
    expect(fails({ lines: [{ productId: P1, unit: 'BOX', quantity: 0 }] })).toBe(false);
    expect(fails({ lines: [{ productId: P1, unit: 'PIECE', quantity: 1.5 }] })).toBe(false);
    expect(fails({ discount: { type: 'FLAT' } })).toBe(false);
    expect(fails({ discount: { type: 'PERCENT', percent: '101' } })).toBe(false);
    expect(fails({ billGst: { applied: true } })).toBe(false);
    expect(fails({ expectedTotal: '1.005' })).toBe(false);
  });
});

describe('refund and order list inputs (F-15, F-16)', () => {
  const refund = (overrides: Record<string, unknown>) => ({
    idempotencyKey: KEY,
    orderId: P1,
    expectedAmount: '10.00',
    ...overrides,
  });

  it('takes exactly one of lines or refundAll', () => {
    expect(refundOrderInputSchema.safeParse(refund({ refundAll: true })).success).toBe(true);
    expect(
      refundOrderInputSchema.safeParse(refund({ lines: [{ orderLineId: '12', quantity: 1 }] }))
        .success,
    ).toBe(true);
    expect(refundOrderInputSchema.safeParse(refund({})).success).toBe(false);
    expect(
      refundOrderInputSchema.safeParse(
        refund({ refundAll: true, lines: [{ orderLineId: '12', quantity: 1 }] }),
      ).success,
    ).toBe(false);
    expect(
      refundOrderInputSchema.safeParse(refund({ lines: [{ orderLineId: 'x', quantity: 1 }] }))
        .success,
    ).toBe(false);
  });

  it('upper-cases a bill number prefix and checks dates', () => {
    expect(ordersArgsSchema.parse({ filter: { billNumberPrefix: ' ord-2026' } })).toMatchObject({
      filter: { billNumberPrefix: 'ORD-2026' },
    });
    expect(ordersArgsSchema.safeParse({ filter: { from: '2026-02-30' } }).success).toBe(false);
  });
});
