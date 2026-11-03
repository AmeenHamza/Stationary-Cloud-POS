import { Injectable } from '@nestjs/common';

import { StockRepository, type SaleProductRow } from '../persistence/stock.repository';

import { StockLedgerService, type StockLevel } from './stock-ledger.service';

export interface StockReference {
  orderId?: string;
  refundId?: string;
}

/**
 * Stock for billing (SYSTEM_DESIGN.md §3.3, §3.6), used by the sales module: lock the bill's
 * products in ascending id order, then move stock as SALE (−) or REFUND (+) movements through the
 * stock ledger in one statement, with one `stock.changed` for the whole bill.
 */
@Injectable()
export class SaleStockService {
  constructor(
    private readonly stock: StockRepository,
    private readonly ledger: StockLedgerService,
  ) {}

  lock(productIds: readonly string[]): Promise<SaleProductRow[]> {
    return this.stock.lockForSale([...new Set(productIds)].sort());
  }

  /**
   * `pieces` per item are positive; a product sold on two lines (piece and box) is merged. A sale
   * already holds its locks (`lock`); a refund takes them here, in the same ascending order.
   */
  async move(
    type: 'SALE' | 'REFUND',
    reference: StockReference,
    items: readonly { productId: string; pieces: number }[],
    actorUserId: string | null,
  ): Promise<StockLevel[]> {
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.pieces);
    }
    const changes = [...totals.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([productId, pieces]) => ({
        productId,
        type,
        quantityPieces: type === 'SALE' ? -pieces : pieces,
        reason: null,
        note: null,
        actorUserId,
        idempotencyKey: null,
        requestHash: null,
        orderId: reference.orderId ?? null,
        refundId: reference.refundId ?? null,
      }));
    if (type === 'REFUND') {
      await this.stock.lockInOrder(changes.map((change) => change.productId));
    }
    return this.ledger.applyAll(changes);
  }
}
