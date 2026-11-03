import { Injectable } from '@nestjs/common';

import { AppError } from '../../../../common/errors/app-error';
import { TransactionalClient } from '../../../../infrastructure/prisma/transactional-client';

import type { AdjustmentReason, StockMovementType } from '@pos/contracts';

export interface LockedProduct {
  id: string;
  piecesPerBox: number;
  stockPieces: number;
  lowStockThresholdPieces: number;
}

export interface NewMovement {
  productId: string;
  type: StockMovementType;
  quantityPieces: number;
  balanceAfter: number;
  reason: AdjustmentReason | null;
  note: string | null;
  actorUserId: string | null;
  idempotencyKey: string | null;
  requestHash: Uint8Array<ArrayBuffer> | null;
  orderId?: string | null;
  refundId?: string | null;
  importJobId?: string | null;
}

/** A product as a bill is priced from: decimals as exact text, read under the row lock. */
export interface SaleProductRow {
  id: string;
  name: string;
  nameUrdu: string | null;
  barcode: string | null;
  salePrice: string;
  boxPrice: string | null;
  piecesPerBox: number;
  stockPieces: number;
  taxRate: string;
  archivedAt: Date | null;
}

/** A product's stock right after a change: what events, warnings and threshold checks need. */
export interface StockRow {
  id: string;
  name: string;
  stockPieces: number;
  lowStockThresholdPieces: number;
  version: number;
  archivedAt: Date | null;
}

/** Stock and the append-only ledger (DATABASE.md §4.5–4.6, §6). Callers run inside UnitOfWork. */
@Injectable()
export class StockRepository {
  constructor(private readonly db: TransactionalClient) {}

  /** Row lock on an active product before reading its box size (concurrent changes serialize). */
  async lockActive(productId: string): Promise<LockedProduct> {
    const rows = await this.db.client.$queryRaw<LockedProduct[]>`
      SELECT id, pieces_per_box AS "piecesPerBox", stock_pieces AS "stockPieces",
             low_stock_threshold_pieces AS "lowStockThresholdPieces"
      FROM products WHERE id = ${productId}::uuid AND archived_at IS NULL FOR UPDATE`;
    const row = rows[0];
    if (row === undefined) {
      throw new AppError('NOT_FOUND', 'This product does not exist or is archived.');
    }
    return row;
  }

  /**
   * Locks a bill's products in ascending id order (deadlock-free, DATABASE.md §6) and reads the
   * prices the bill is calculated from (rule 6). Archived rows are returned; callers decide.
   */
  lockForSale(ids: readonly string[]): Promise<SaleProductRow[]> {
    return this.db.client.$queryRaw<SaleProductRow[]>`
      SELECT id, name, name_urdu AS "nameUrdu", barcode, sale_price::text AS "salePrice",
             box_price::text AS "boxPrice", pieces_per_box AS "piecesPerBox",
             stock_pieces AS "stockPieces", tax_rate::text AS "taxRate", archived_at AS "archivedAt"
      FROM products WHERE id = ANY(${[...ids]}::uuid[]) ORDER BY id FOR UPDATE`;
  }

  /** Row locks in ascending id order, for a change whose caller has not locked yet (refunds). */
  async lockInOrder(ids: readonly string[]): Promise<void> {
    await this.db.client.$queryRaw`
      SELECT id FROM products WHERE id = ANY(${[...ids]}::uuid[]) ORDER BY id FOR UPDATE`;
  }

  /**
   * `stock_pieces = stock_pieces + delta` for every product of a change in one statement (NET-03:
   * one round trip per bill, not three per line), so no concurrent update is lost. The caller holds
   * the row locks, taken in ascending id order (DATABASE.md §6). One delta per product.
   */
  applyDeltas(changes: readonly { productId: string; delta: number }[]): Promise<StockRow[]> {
    const ids = changes.map((change) => change.productId);
    const deltas = changes.map((change) => change.delta);
    return this.db.client.$queryRaw<StockRow[]>`
      UPDATE products p
      SET stock_pieces = p.stock_pieces + c.delta, version = p.version + 1, updated_at = now()
      FROM unnest(${ids}::uuid[], ${deltas}::int[]) AS c(id, delta)
      WHERE p.id = c.id
      RETURNING p.id, p.name, p.stock_pieces AS "stockPieces",
                p.low_stock_threshold_pieces AS "lowStockThresholdPieces", p.version,
                p.archived_at AS "archivedAt"`;
  }

  async insertMovements(movements: readonly NewMovement[]): Promise<void> {
    await this.db.client.stockMovement.createMany({ data: [...movements] });
  }

  findMovementByKey(
    idempotencyKey: string,
  ): Promise<{ productId: string; requestHash: Uint8Array | null } | null> {
    return this.db.client.stockMovement.findUnique({
      where: { idempotencyKey },
      select: { productId: true, requestHash: true },
    });
  }
}
