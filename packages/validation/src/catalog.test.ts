import { describe, expect, it } from 'vitest';

import {
  adjustStockInputSchema,
  cloneProductInputSchema,
  createCategoryInputSchema,
  createProductInputSchema,
  productIdsSchema,
  productsArgsSchema,
  restockInputSchema,
} from './index.js';

import type { z } from 'zod';

const ok = (schema: z.ZodType, value: unknown): boolean => schema.safeParse(value).success;
const KEY = '0192f0c1-0000-7000-8000-000000000001';
const ID = '0192f0c1-0000-7000-8000-000000000002';

const product = {
  idempotencyKey: KEY,
  barcode: ' 6932673758251 ',
  name: '  Deli gel pen ',
  nameUrdu: '',
  categoryId: null,
  baseUnitLabel: 'Piece',
  piecesPerBox: 12,
  salePrice: '120.00',
  boxPrice: '1300',
  costPrice: '',
  taxRate: '0',
  lowStockThreshold: 2,
  lowStockThresholdUnit: 'BOX',
  initialStockPieces: 24,
};

describe('product inputs (F-08, D-17)', () => {
  it('trims text and turns empty optional fields into null', () => {
    const parsed = createProductInputSchema.parse(product);
    expect(parsed).toMatchObject({
      barcode: '6932673758251',
      name: 'Deli gel pen',
      nameUrdu: null,
    });
    expect(parsed.costPrice).toBeNull();
  });

  it('refuses a box price unless a box holds more than one piece', () => {
    expect(ok(createProductInputSchema, { ...product, piecesPerBox: 1 })).toBe(false);
    expect(ok(createProductInputSchema, { ...product, piecesPerBox: 1, boxPrice: '' })).toBe(true);
  });

  it('refuses negative or fractional amounts, prices with 3 decimals and taxes over 100', () => {
    expect(ok(createProductInputSchema, { ...product, initialStockPieces: -1 })).toBe(false);
    expect(ok(createProductInputSchema, { ...product, piecesPerBox: 1.5 })).toBe(false);
    expect(ok(createProductInputSchema, { ...product, salePrice: '1.234' })).toBe(false);
    expect(ok(createProductInputSchema, { ...product, taxRate: '101' })).toBe(false);
  });

  it('clone needs a barcode; lookups and lists are bounded', () => {
    const clone = {
      idempotencyKey: KEY,
      sourceProductId: ID,
      barcode: 'X1',
      initialStockPieces: 1,
    };
    expect(ok(cloneProductInputSchema, clone)).toBe(true);
    expect(ok(cloneProductInputSchema, { ...clone, barcode: ' ' })).toBe(false);
    expect(ok(productIdsSchema, Array<string>(51).fill(ID))).toBe(false);
    expect(productsArgsSchema.parse({})).toMatchObject({ first: 50, sort: 'NAME_ASC' });
    expect(ok(productsArgsSchema, { sort: 'STOCK_ASC' })).toBe(false);
  });
});

describe('inventory inputs (F-10, D-18)', () => {
  it('restock adds at least one piece', () => {
    const restock = { idempotencyKey: KEY, productId: ID, boxes: 0, pieces: 0 };
    expect(ok(restockInputSchema, restock)).toBe(false);
    expect(ok(restockInputSchema, { ...restock, boxes: 2 })).toBe(true);
  });

  it('an adjustment needs a direction, a positive quantity and a reason', () => {
    const adjust = { idempotencyKey: KEY, productId: ID, direction: 'DECREASE', quantityPieces: 3 };
    expect(ok(adjustStockInputSchema, adjust)).toBe(false);
    expect(ok(adjustStockInputSchema, { ...adjust, reason: 'DAMAGED' })).toBe(true);
    expect(ok(adjustStockInputSchema, { ...adjust, reason: 'DAMAGED', quantityPieces: 0 })).toBe(
      false,
    );
  });
});

describe('category inputs (F-12)', () => {
  it('requires a name of at most 80 characters', () => {
    expect(ok(createCategoryInputSchema, { name: 'Notebooks' })).toBe(true);
    expect(ok(createCategoryInputSchema, { name: ' ' })).toBe(false);
    expect(ok(createCategoryInputSchema, { name: 'x'.repeat(81) })).toBe(false);
  });
});
