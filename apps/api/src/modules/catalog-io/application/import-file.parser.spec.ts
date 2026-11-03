import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { productImportRowSchema } from '@pos/validation';

import { parseImportFile } from './import-file.parser';

const legacyHeader = [
  'name',
  'barcode',
  'name_urdu',
  'price',
  'cost',
  'stock',
  'base_unit_name',
  'pieces_per_box',
  'box_price',
  'low_stock_threshold',
  'tax_rate',
];
const legacyRow = ['Example', '0001234567890', '', '30', '20', '3', 'Piece', '1', '', '1', '18'];

async function assertLegacyRow(fileName: string, bytes: Buffer) {
  const rows = await parseImportFile(fileName, bytes);
  expect(rows).toHaveLength(1);
  const row = productImportRowSchema.parse(rows[0]?.cells);
  expect(row).toMatchObject({
    name: 'Example',
    barcode: '0001234567890',
    salePrice: '30',
    costPrice: '20',
    openingStock: 3,
    baseUnitLabel: 'Piece',
    piecesPerBox: 1,
    boxPrice: null,
    lowStockThreshold: 1,
    lowStockThresholdUnit: 'PIECE',
    taxRate: '18',
  });
}

describe('product import headers', () => {
  it('accepts the legacy CSV headers without losing stock, prices, or barcode text', async () => {
    await assertLegacyRow(
      'products.csv',
      Buffer.from([legacyHeader.join(','), legacyRow.join(',')].join('\n')),
    );
  });

  it('accepts the same legacy headers in an XLSX file', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');
    sheet.addRow(legacyHeader);
    sheet.addRow(legacyRow);
    await assertLegacyRow('products.xlsx', Buffer.from(await workbook.xlsx.writeBuffer()));
  });

  it('continues to accept template headers in mixed order and case', async () => {
    const rows = await parseImportFile(
      'products.csv',
      Buffer.from('Sale price,NAME,Barcode\n20,Example,000123'),
    );
    expect(productImportRowSchema.parse(rows[0]?.cells)).toMatchObject({
      name: 'Example',
      salePrice: '20',
      barcode: '000123',
      openingStock: 0,
    });
  });

  it('rejects ambiguous template and legacy headers for the same field', async () => {
    await expect(
      parseImportFile('products.csv', Buffer.from('Name,Sale price,price\nExample,20,30')),
    ).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
    await expect(
      parseImportFile('products.csv', Buffer.from('Name,price,PRICE\nExample,20,30')),
    ).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
  });
});
