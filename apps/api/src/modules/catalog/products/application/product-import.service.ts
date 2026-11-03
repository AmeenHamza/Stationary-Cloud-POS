import { Injectable } from '@nestjs/common';

import { CacheInvalidation } from '../../../../infrastructure/cache/cache-invalidation';
import { OutboxService } from '../../../../infrastructure/realtime/outbox.service';
import { CategoriesRepository } from '../../categories/persistence/categories.repository';
import { StockRepository } from '../../inventory/persistence/stock.repository';
import { ProductsRepository } from '../persistence/products.repository';

import { productData } from './product-data';

import type { ProductImportRow } from '@pos/validation';

/** A validated row with its category resolved at staging (null = Uncategorised). */
export type ImportedProduct = Omit<ProductImportRow, 'categoryName'> & {
  categoryId: string | null;
};

/**
 * Product writes for imports (F-11, SYSTEM_DESIGN.md §7), kept in the catalogue because it owns
 * products. Rows are matched by barcode (Q14): an active product with that barcode gets the row's
 * attributes, never its stock (BR-03); otherwise a product is inserted with an OPENING movement
 * linked to the job. Per-product events are replaced by one `catalog.bulkChanged` at the end.
 */
@Injectable()
export class ProductImportService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly stock: StockRepository,
    private readonly categories: CategoriesRepository,
    private readonly outbox: OutboxService,
    private readonly invalidation: CacheInvalidation,
  ) {}

  /** Category ids by lower-cased name, for the names an upload uses (unknown names are absent). */
  categoryIds(names: readonly string[]): Promise<Map<string, string>> {
    return this.categories.findIdsByNames(names);
  }

  /** Applies one row in the caller's transaction; returns the product and whether it is new. */
  async apply(row: ImportedProduct, jobId: string, actorUserId: string) {
    const { openingStock, ...fields } = row;
    const data = productData(fields);
    const existing =
      fields.barcode === null ? null : await this.products.findActiveByBarcode(fields.barcode);
    if (existing !== null) {
      const updated = await this.products.update(existing.id, existing.version, data);
      return { productId: updated.id, created: false };
    }
    const created = await this.products.insert({ ...data, stockPieces: openingStock });
    if (openingStock > 0) {
      await this.stock.insertMovements([
        {
          productId: created.id,
          type: 'OPENING',
          quantityPieces: openingStock,
          balanceAfter: openingStock,
          reason: null,
          note: null,
          actorUserId,
          idempotencyKey: null,
          requestHash: null,
          importJobId: jobId,
        },
      ]);
    }
    return { productId: created.id, created: true };
  }

  /** After the last batch: lists and counts everywhere refresh once (API.md §7.2). */
  async finish(jobId: string, changedCount: number): Promise<void> {
    if (changedCount === 0) {
      return;
    }
    await this.outbox.add('catalog.bulkChanged', 'staff', {
      reason: 'IMPORT',
      importJobId: jobId,
      changedCount,
    });
    await this.outbox.add('lowStock.countChanged', 'admin', { crossedProductIds: [] });
    this.invalidation.after('categories');
  }
}
