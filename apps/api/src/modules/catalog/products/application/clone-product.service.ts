import { Injectable } from '@nestjs/common';

import { AppError } from '../../../../common/errors/app-error';
import { runIdempotent } from '../../../../common/idempotency/idempotent-replay';
import { requestHashBytes } from '../../../../common/idempotency/request-hash';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { ProductsRepository } from '../persistence/products.repository';

import { NewProductRecorder } from './new-product-recorder';
import { cloneData, mapProductWriteErrors } from './product-data';

import type { ProductView } from './product-view';
import type { Principal } from '../../../../common/auth/principal';
import type { CloneProductInput } from '@pos/validation';

/**
 * `cloneProduct` [K] (F-09, D-19): one call per newly scanned barcode creates a separate product that
 * copies every attribute of the source except barcode and stock (BR-04).
 */
@Injectable()
export class CloneProductService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly recorder: NewProductRecorder,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: CloneProductInput, viewer: Principal): Promise<ProductView> {
    const requestHash = requestHashBytes(input);
    return mapProductWriteErrors(() =>
      runIdempotent({
        keyColumn: 'idempotency_key',
        requestHash,
        replay: () => this.recorder.replay(input.idempotencyKey),
        execute: () =>
          this.uow.run(async () => {
            const source = await this.products.findById(input.sourceProductId);
            if (source === null) {
              throw new AppError('NOT_FOUND', 'The product to clone does not exist.');
            }
            const row = await this.products.insert({
              ...cloneData(source),
              barcode: input.barcode,
              stockPieces: input.initialStockPieces,
              idempotencyKey: input.idempotencyKey,
              requestHash,
            });
            return this.recorder.record(row, viewer, {
              action: 'product.cloned',
              metadata: { sourceProductId: source.id },
            });
          }),
      }),
    );
  }
}
