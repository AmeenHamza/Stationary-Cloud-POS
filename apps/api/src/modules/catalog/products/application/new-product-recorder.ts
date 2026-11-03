import { Injectable } from '@nestjs/common';

import { CacheInvalidation } from '../../../../infrastructure/cache/cache-invalidation';
import { AuditService, type AuditDetails } from '../../../audit';
import { StockRepository } from '../../inventory/persistence/stock.repository';
import { ProductsRepository } from '../persistence/products.repository';

import { ProductEvents } from './product-events';
import { toProductView, type ProductView } from './product-view';

import type { Principal } from '../../../../common/auth/principal';
import type { ProductRow } from '../persistence/products.repository';

export interface NewProductAudit {
  action: 'product.created' | 'product.cloned';
  metadata: NonNullable<AuditDetails['metadata']>;
}

/**
 * What every newly inserted product needs, inside the caller's transaction: the OPENING movement
 * for its starting stock, `product.changed` (and `lowStock.countChanged` if it starts low), the
 * category counts invalidated after commit, and the audit row. Used by create and clone, which also
 * share the idempotent replay of an already-created product.
 */
@Injectable()
export class NewProductRecorder {
  constructor(
    private readonly products: ProductsRepository,
    private readonly stock: StockRepository,
    private readonly events: ProductEvents,
    private readonly invalidation: CacheInvalidation,
    private readonly audit: AuditService,
  ) {}

  /** The product an earlier call with this idempotency key created, with that call's hash. */
  async replay(
    idempotencyKey: string,
  ): Promise<{ requestHash: Uint8Array; result: ProductView } | null> {
    const found = await this.products.findByIdempotencyKey(idempotencyKey);
    return found && { requestHash: found.requestHash, result: toProductView(found.product) };
  }

  async record(row: ProductRow, viewer: Principal, audit: NewProductAudit): Promise<ProductView> {
    if (row.stockPieces > 0) {
      await this.stock.insertMovements([
        {
          productId: row.id,
          type: 'OPENING',
          quantityPieces: row.stockPieces,
          balanceAfter: row.stockPieces,
          reason: null,
          note: null,
          actorUserId: viewer.userId,
          idempotencyKey: null,
          requestHash: null,
        },
      ]);
    }
    const view = toProductView(row);
    await this.events.changed('CREATED', view);
    await this.events.lowStockCrossed(view.isLowStock ? [view.id] : []);
    this.invalidation.after('categories');
    await this.audit.record(audit.action, viewer.userId, {
      entityType: 'product',
      entityId: view.id,
      metadata: audit.metadata,
    });
    return view;
  }
}
