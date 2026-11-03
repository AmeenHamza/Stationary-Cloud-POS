import { Injectable } from '@nestjs/common';

import { restockPieces } from '@pos/domain';

import { runIdempotent } from '../../../../common/idempotency/idempotent-replay';
import { requestHashBytes } from '../../../../common/idempotency/request-hash';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../../audit';
import { StockRepository } from '../persistence/stock.repository';

import { StockLedgerService } from './stock-ledger.service';

import type { Principal } from '../../../../common/auth/principal';
import type { ProductView } from '../../products/application/product-view';
import type { RestockInput } from '@pos/validation';

/** `restockProduct` [K] (F-10): adds `boxes × piecesPerBox + pieces` as a RESTOCK movement. */
@Injectable()
export class RestockService {
  constructor(
    private readonly stock: StockRepository,
    private readonly ledger: StockLedgerService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: RestockInput, viewer: Principal): Promise<ProductView> {
    const hash = requestHashBytes(input);
    return runIdempotent({
      keyColumn: 'idempotency_key',
      requestHash: hash,
      replay: () => this.ledger.replay(input.idempotencyKey),
      execute: () =>
        this.uow.run(async () => {
          const product = await this.stock.lockActive(input.productId);
          const pieces = restockPieces(input.boxes, input.pieces, product.piecesPerBox);
          const view = await this.ledger.apply({
            productId: input.productId,
            type: 'RESTOCK',
            quantityPieces: pieces,
            reason: null,
            note: input.note,
            actorUserId: viewer.userId,
            idempotencyKey: input.idempotencyKey,
            requestHash: hash,
          });
          await this.audit.record('stock.restocked', viewer.userId, {
            entityType: 'product',
            entityId: input.productId,
            metadata: { pieces, stockAfter: view.stockPieces },
          });
          return view;
        }),
    });
  }
}
