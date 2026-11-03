import { describe, expect, it, vi } from 'vitest';

import { productImportRowSchema } from '@pos/validation';

import { ProductImportService } from './product-import.service';

function legacyRow() {
  const { categoryName, ...row } = productImportRowSchema.parse({
    name: 'Example',
    barcode: 'EXAMPLE-001',
    salePrice: '30',
    costPrice: '20',
    openingStock: '3',
    taxRate: '18',
  });
  expect(categoryName).toBeNull();
  return { ...row, categoryId: null };
}

describe('legacy product import stock', () => {
  it('preserves the stock of an existing barcode match', async () => {
    const products = {
      findActiveByBarcode: vi.fn().mockResolvedValue({ id: 'existing', version: 4 }),
      update: vi.fn().mockResolvedValue({ id: 'existing' }),
    };
    const stock = { insertMovements: vi.fn() };
    const service = new ProductImportService(
      products as unknown as ConstructorParameters<typeof ProductImportService>[0],
      stock as unknown as ConstructorParameters<typeof ProductImportService>[1],
      {} as ConstructorParameters<typeof ProductImportService>[2],
      {} as ConstructorParameters<typeof ProductImportService>[3],
      {} as ConstructorParameters<typeof ProductImportService>[4],
    );
    await expect(service.apply(legacyRow(), 'job', 'actor')).resolves.toEqual({
      productId: 'existing',
      created: false,
    });
    const data = products.update.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(data).toMatchObject({ salePrice: '30', costPrice: '20', taxRate: '18' });
    expect(data).not.toHaveProperty('stockPieces');
    expect(data).not.toHaveProperty('openingStock');
    expect(stock.insertMovements).not.toHaveBeenCalled();
  });

  it('sets opening stock and creates a stock movement for a new product', async () => {
    const products = {
      findActiveByBarcode: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockResolvedValue({ id: 'new' }),
    };
    const stock = { insertMovements: vi.fn().mockResolvedValue(undefined) };
    const service = new ProductImportService(
      products as unknown as ConstructorParameters<typeof ProductImportService>[0],
      stock as unknown as ConstructorParameters<typeof ProductImportService>[1],
      {} as ConstructorParameters<typeof ProductImportService>[2],
      {} as ConstructorParameters<typeof ProductImportService>[3],
      {} as ConstructorParameters<typeof ProductImportService>[4],
    );
    await expect(service.apply(legacyRow(), 'job', 'actor')).resolves.toEqual({
      productId: 'new',
      created: true,
    });
    expect(products.insert).toHaveBeenCalledWith(expect.objectContaining({ stockPieces: 3 }));
    expect(stock.insertMovements).toHaveBeenCalledWith([
      expect.objectContaining({ productId: 'new', type: 'OPENING', quantityPieces: 3 }),
    ]);
  });
});
