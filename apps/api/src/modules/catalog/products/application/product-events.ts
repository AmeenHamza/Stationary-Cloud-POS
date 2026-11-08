import { Injectable } from '@nestjs/common';

import { MAX_EVENT_BYTES, type ProductChange } from '@pos/contracts';

import { moneyText } from '../../../../common/graphql/scalars';
import { OutboxService } from '../../../../infrastructure/realtime/outbox.service';

import type { ProductView } from './product-view';

/** Public fields only: never `costPrice` (API.md §7.2). Money as exact strings. */
function snapshot(view: ProductView): Record<string, unknown> {
  return {
    id: view.id,
    barcode: view.barcode,
    name: view.name,
    nameUrdu: view.nameUrdu,
    categoryId: view.categoryId,
    baseUnitLabel: view.baseUnitLabel,
    piecesPerBox: view.piecesPerBox,
    salePrice: moneyText(view.salePrice),
    boxPrice: view.boxPrice === null ? null : moneyText(view.boxPrice),
    taxRate: moneyText(view.taxRate),
    lowStockThresholdPieces: view.lowStockThresholdPieces,
    lowStockThresholdUnit: view.lowStockThresholdUnit,
    stockPieces: view.stockPieces,
    isLowStock: view.isLowStock,
    archivedAt: view.archivedAt?.toISOString() ?? null,
    version: view.version,
  };
}

/**
 * Catalogue events, added in the caller's transaction (ADR-009). A snapshot that would push the
 * payload over 1 KB (very long English and Urdu names together) is replaced by null: clients then
 * evict and refetch that product instead of the event being refused.
 */
@Injectable()
export class ProductEvents {
  constructor(private readonly outbox: OutboxService) {}

  async changed(change: ProductChange, view: ProductView): Promise<void> {
    const full = { change, productId: view.id, version: view.version, product: snapshot(view) };
    const fits = Buffer.byteLength(JSON.stringify(full)) <= MAX_EVENT_BYTES;
    await this.outbox.add('product.changed', 'staff', fits ? full : { ...full, product: null });
  }

  /** A deleted product has no snapshot: clients evict it, and cached lists drop it (D-28). */
  async deleted(productId: string, version: number): Promise<void> {
    await this.outbox.add('product.changed', 'staff', {
      change: 'DELETED',
      productId,
      version,
      product: null,
    });
  }

  /** One event for all products of one transaction (≤ 100 lines, ≤ 1 KB per API.md §7.2). */
  async stockChanged(
    views: readonly Pick<ProductView, 'id' | 'stockPieces' | 'isLowStock' | 'version'>[],
  ): Promise<void> {
    if (views.length === 0) {
      return;
    }
    await this.outbox.add('stock.changed', 'staff', {
      items: views.map((view) => ({
        productId: view.id,
        stockPieces: view.stockPieces,
        isLowStock: view.isLowStock,
        version: view.version,
      })),
    });
  }

  /** Emitted when products enter or leave the low-stock list (threshold, stock, archive, restore). */
  async lowStockCrossed(productIds: readonly string[]): Promise<void> {
    if (productIds.length > 0) {
      await this.outbox.add('lowStock.countChanged', 'admin', {
        crossedProductIds: [...productIds],
      });
    }
  }
}
