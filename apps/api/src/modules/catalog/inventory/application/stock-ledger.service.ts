import { Injectable } from '@nestjs/common';

import { crossesLowStockThreshold } from '@pos/domain';

import { AppError } from '../../../../common/errors/app-error';
import { ProductEvents } from '../../products/application/product-events';
import {
  lowStockOf,
  toProductView,
  type ProductView,
} from '../../products/application/product-view';
import { ProductsRepository } from '../../products/persistence/products.repository';
import { StockRepository, type NewMovement } from '../persistence/stock.repository';

export type StockChange = Omit<NewMovement, 'balanceAfter'>;

/** A product's stock after a change, as events and sale warnings use it. */
export interface StockLevel {
  id: string;
  name: string;
  stockPieces: number;
  isLowStock: boolean;
  version: number;
}

/**
 * The single way stock changes (ADR-016): update the products, append the movements with their
 * balance after, and add `stock.changed` (plus `lowStock.countChanged` on a threshold crossing) to
 * the outbox — all in the caller's transaction, which already holds the product row locks.
 */
@Injectable()
export class StockLedgerService {
  constructor(
    private readonly stock: StockRepository,
    private readonly products: ProductsRepository,
    private readonly events: ProductEvents,
  ) {}

  /** One change (restock, adjustment), returning the product as the Product type renders it. */
  async apply(change: StockChange): Promise<ProductView> {
    await this.applyAll([change]);
    const product = await this.products.findById(change.productId);
    if (product === null) {
      throw new AppError('NOT_FOUND', 'This product does not exist.');
    }
    return toProductView(product);
  }

  /**
   * Several changes in one transaction (a bill or a refund), one per product: one UPDATE and one
   * INSERT for all of them (NET-03) and one `stock.changed`.
   */
  async applyAll(changes: readonly StockChange[]): Promise<StockLevel[]> {
    const rows = await this.stock.applyDeltas(
      changes.map((change) => ({ productId: change.productId, delta: change.quantityPieces })),
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    const applied = changes.map((change) => {
      const row = byId.get(change.productId);
      if (row === undefined) {
        throw new AppError('NOT_FOUND', 'This product does not exist.');
      }
      return { change, row };
    });
    await this.stock.insertMovements(
      applied.map(({ change, row }) => ({ ...change, balanceAfter: row.stockPieces })),
    );
    const levels = applied.map(({ row }) => ({
      id: row.id,
      name: row.name,
      stockPieces: row.stockPieces,
      isLowStock: lowStockOf(row),
      version: row.version,
    }));
    await this.events.stockChanged(levels);
    await this.events.lowStockCrossed(
      applied
        .filter(({ change, row }) =>
          crossesLowStockThreshold(
            row.stockPieces - change.quantityPieces,
            row.stockPieces,
            row.lowStockThresholdPieces,
          ),
        )
        .map(({ row }) => row.id),
    );
    return levels;
  }

  /** For a duplicate idempotency key: the stored request hash and the product as it is now. */
  async replay(
    idempotencyKey: string,
  ): Promise<{ requestHash: Uint8Array; result: ProductView } | null> {
    const movement = await this.stock.findMovementByKey(idempotencyKey);
    const product = movement === null ? null : await this.products.findById(movement.productId);
    if (movement?.requestHash == null || product === null) {
      return null;
    }
    return { requestHash: movement.requestHash, result: toProductView(product) };
  }
}
