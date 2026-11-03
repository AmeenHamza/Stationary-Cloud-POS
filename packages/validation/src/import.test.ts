import { describe, expect, it } from 'vitest';

import { productExportQuerySchema, productImportRowSchema } from './import.schemas.js';
import {
  dailySalesArgsSchema,
  dashboardDateSchema,
  productRankingArgsSchema,
} from './reporting.schemas.js';

describe('product import rows (F-11, Q37)', () => {
  it('fills documented defaults for blank optional cells', () => {
    expect(productImportRowSchema.parse({ name: 'Pen', salePrice: '10', barcode: ' ' })).toEqual({
      barcode: null,
      name: 'Pen',
      nameUrdu: null,
      categoryName: null,
      baseUnitLabel: 'Piece',
      piecesPerBox: 1,
      salePrice: '10',
      boxPrice: null,
      costPrice: null,
      taxRate: '0',
      lowStockThreshold: 0,
      lowStockThresholdUnit: 'PIECE',
      openingStock: 0,
    });
  });

  it('reads whole numbers and units from text, and refuses bad cells', () => {
    const row = productImportRowSchema.parse({
      name: 'Box of pens',
      salePrice: '30.00',
      piecesPerBox: '12',
      boxPrice: '330',
      lowStockThresholdUnit: 'box',
      openingStock: '120',
    });
    expect(row).toMatchObject({
      piecesPerBox: 12,
      lowStockThresholdUnit: 'BOX',
      openingStock: 120,
    });
    const fails = (cells: Record<string, string>) =>
      productImportRowSchema.safeParse({ name: 'X', salePrice: '1', ...cells }).success;
    expect(fails({ salePrice: '1.005' })).toBe(false);
    expect(fails({ piecesPerBox: '1.5' })).toBe(false);
    expect(fails({ boxPrice: '10' })).toBe(false); // a box price needs boxes of more than one piece
    expect(fails({ openingStock: '-3' })).toBe(false);
    expect(fails({ lowStockThresholdUnit: 'crate' })).toBe(false);
    expect(productImportRowSchema.safeParse({ salePrice: '1' }).success).toBe(false);
  });

  it('accepts only the export formats and reads includeArchived from the query string', () => {
    expect(productExportQuerySchema.parse({ format: 'csv', includeArchived: 'true' })).toEqual({
      format: 'csv',
      includeArchived: true,
    });
    expect(productExportQuerySchema.safeParse({ format: 'docx' }).success).toBe(false);
  });
});

describe('dashboard arguments (API.md §3, §6.3)', () => {
  it('defaults and bounds the date, days, limit and look-back window', () => {
    expect(dashboardDateSchema.parse(undefined)).toBeNull();
    expect(dashboardDateSchema.safeParse('2026-13-01').success).toBe(false);
    expect(dailySalesArgsSchema.parse({})).toEqual({ days: 7, productId: null });
    expect(dailySalesArgsSchema.safeParse({ days: 32 }).success).toBe(false);
    expect(productRankingArgsSchema.parse({ direction: 'LOWEST' })).toEqual({
      direction: 'LOWEST',
      limit: 5,
      days: 30,
    });
    expect(productRankingArgsSchema.safeParse({ direction: 'HIGHEST', limit: 11 }).success).toBe(
      false,
    );
  });
});
