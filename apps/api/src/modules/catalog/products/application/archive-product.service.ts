import { Injectable } from '@nestjs/common';

import { AppError } from '../../../../common/errors/app-error';
import { ClockService } from '../../../../common/time/clock.service';
import { CacheInvalidation } from '../../../../infrastructure/cache/cache-invalidation';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../../audit';
import { ProductsRepository } from '../persistence/products.repository';

import { mapProductWriteErrors } from './product-data';
import { ProductEvents } from './product-events';
import { toProductView, type ProductView } from './product-view';

import type { Principal } from '../../../../common/auth/principal';

/**
 * `archiveProduct` / `restoreProduct` (Q16b): products are never deleted, because orders and the
 * stock ledger reference them. Archiving takes the product off the shelf (and off the low-stock
 * list); restoring fails with a barcode CONFLICT if another active product took the barcode.
 * Repeating either call on a product already in that state returns it unchanged.
 */
@Injectable()
export class ArchiveProductService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly events: ProductEvents,
    private readonly invalidation: CacheInvalidation,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly uow: UnitOfWork,
  ) {}

  archive(id: string, viewer: Principal): Promise<ProductView> {
    return this.setArchived(id, true, viewer);
  }

  restore(id: string, viewer: Principal): Promise<ProductView> {
    return this.setArchived(id, false, viewer);
  }

  private setArchived(id: string, archive: boolean, viewer: Principal): Promise<ProductView> {
    return mapProductWriteErrors(() =>
      this.uow.run(async () => {
        const before = await this.products.findById(id);
        if (before === null) {
          throw new AppError('NOT_FOUND', 'This product does not exist.');
        }
        const previous = toProductView(before);
        if ((before.archivedAt !== null) === archive) {
          return previous;
        }
        const row = await this.products.setArchivedAt(id, archive ? this.clock.now() : null);
        const view = toProductView(row);
        await this.events.changed(archive ? 'ARCHIVED' : 'RESTORED', view);
        await this.events.lowStockCrossed(previous.isLowStock === view.isLowStock ? [] : [id]);
        this.invalidation.after('categories');
        await this.audit.record(archive ? 'product.archived' : 'product.restored', viewer.userId, {
          entityType: 'product',
          entityId: id,
        });
        return view;
      }),
    );
  }
}
