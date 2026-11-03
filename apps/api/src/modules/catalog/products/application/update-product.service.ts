import { Injectable } from '@nestjs/common';

import { AppError } from '../../../../common/errors/app-error';
import { CacheInvalidation } from '../../../../infrastructure/cache/cache-invalidation';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../../audit';
import { ProductsRepository } from '../persistence/products.repository';

import { mapProductWriteErrors, productData } from './product-data';
import { ProductEvents } from './product-events';
import { toProductView, type ProductView } from './product-view';

import type { Principal } from '../../../../common/auth/principal';
import type { UpdateProductInput } from '@pos/validation';

/** Field names compared to record which attributes an edit touched (no values: rule 10). */
const AUDITED_FIELDS = [
  'barcode',
  'name',
  'nameUrdu',
  'categoryId',
  'baseUnitLabel',
  'piecesPerBox',
  'salePrice',
  'boxPrice',
  'costPrice',
  'taxRate',
  'lowStockThresholdPieces',
  'lowStockThresholdUnit',
] as const;

/**
 * `updateProduct` [V] (F-08). Stock is never edited here (BR-03): it changes only through the stock
 * ledger. A stale `version` is a CONFLICT; a threshold edit can move the product across the
 * low-stock line, which the badge learns from `lowStock.countChanged`.
 */
@Injectable()
export class UpdateProductService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly events: ProductEvents,
    private readonly invalidation: CacheInvalidation,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: UpdateProductInput, viewer: Principal): Promise<ProductView> {
    const { id, version, ...fields } = input;
    return mapProductWriteErrors(() =>
      this.uow.run(async () => {
        const before = await this.products.findById(id);
        if (before === null) {
          throw new AppError('NOT_FOUND', 'This product does not exist.');
        }
        const row = await this.products.update(id, version, productData(fields));
        const previous = toProductView(before);
        const view = toProductView(row);
        await this.events.changed('UPDATED', view);
        await this.events.lowStockCrossed(previous.isLowStock === view.isLowStock ? [] : [id]);
        if (previous.categoryId !== view.categoryId) {
          this.invalidation.after('categories');
        }
        const changed = AUDITED_FIELDS.filter((key) => String(before[key]) !== String(row[key]));
        await this.audit.record('product.updated', viewer.userId, {
          entityType: 'product',
          entityId: id,
          metadata: { fields: changed },
        });
        return view;
      }),
    );
  }
}
