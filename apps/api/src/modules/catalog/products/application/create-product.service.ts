import { Injectable } from '@nestjs/common';

import { runIdempotent } from '../../../../common/idempotency/idempotent-replay';
import { requestHashBytes } from '../../../../common/idempotency/request-hash';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { ProductsRepository } from '../persistence/products.repository';

import { NewProductRecorder } from './new-product-recorder';
import { mapProductWriteErrors, productData } from './product-data';

import type { ProductView } from './product-view';
import type { Principal } from '../../../../common/auth/principal';
import type { CreateProductInput } from '@pos/validation';

/**
 * `createProduct` [K] (F-08). Opening stock is written with the product and recorded as an OPENING
 * movement; the product enters the low-stock list at once when it starts at or below its threshold.
 */
@Injectable()
export class CreateProductService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly recorder: NewProductRecorder,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: CreateProductInput, viewer: Principal): Promise<ProductView> {
    const { idempotencyKey, initialStockPieces, ...fields } = input;
    const requestHash = requestHashBytes(input);
    return mapProductWriteErrors(() =>
      runIdempotent({
        keyColumn: 'idempotency_key',
        requestHash,
        replay: () => this.recorder.replay(idempotencyKey),
        execute: () =>
          this.uow.run(async () => {
            const row = await this.products.insert({
              ...productData(fields),
              stockPieces: initialStockPieces,
              idempotencyKey,
              requestHash,
            });
            return this.recorder.record(row, viewer, {
              action: 'product.created',
              metadata: { initialStockPieces },
            });
          }),
      }),
    );
  }
}
