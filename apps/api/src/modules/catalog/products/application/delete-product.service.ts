import { Injectable } from '@nestjs/common';

import { AppError } from '../../../../common/errors/app-error';
import { CacheInvalidation } from '../../../../infrastructure/cache/cache-invalidation';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../../audit';
import { StockRepository } from '../../inventory/persistence/stock.repository';
import { ProductsRepository } from '../persistence/products.repository';

import { ProductEvents } from './product-events';
import { toProductView } from './product-view';

import type { Principal } from '../../../../common/auth/principal';

/**
 * `deleteProduct` (D-28): removes a product from the database if no bill ever sold it, and refuses
 * with `HAS_HISTORY` otherwise, because bills are kept for good (D-12) and such a product can only be
 * archived. The row lock makes this safe against a sale at another counter: a sale holding the lock
 * finishes first and is then seen here, and a sale arriving after this finds no product (NOT_FOUND).
 */
@Injectable()
export class DeleteProductService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly stock: StockRepository,
    private readonly events: ProductEvents,
    private readonly invalidation: CacheInvalidation,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(id: string, viewer: Principal): Promise<boolean> {
    return this.uow.run(async () => {
      await this.stock.lockInOrder([id]);
      const row = await this.products.findById(id);
      if (row === null) {
        throw new AppError('NOT_FOUND', 'This product does not exist.');
      }
      if (await this.products.isOnBills(id)) {
        throw new AppError(
          'HAS_HISTORY',
          'This product is on past bills, so it cannot be deleted. Archive it instead.',
        );
      }
      const view = toProductView(row);
      await this.products.deleteNeverSold(id);
      await this.events.deleted(id, view.version + 1);
      await this.events.lowStockCrossed(view.isLowStock ? [id] : []);
      this.invalidation.after('categories');
      await this.audit.record('product.deleted', viewer.userId, {
        entityType: 'product',
        entityId: id,
        metadata: { stockPieces: view.stockPieces },
      });
      return true;
    });
  }
}
