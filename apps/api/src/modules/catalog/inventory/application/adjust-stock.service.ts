import { Injectable } from '@nestjs/common';

import { runIdempotent } from '../../../../common/idempotency/idempotent-replay';
import { requestHashBytes } from '../../../../common/idempotency/request-hash';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../../audit';
import { StockRepository } from '../persistence/stock.repository';

import { StockLedgerService } from './stock-ledger.service';

import type { Principal } from '../../../../common/auth/principal';
import type { ProductView } from '../../products/application/product-view';
import type { AdjustStockInput } from '@pos/validation';

/**
 * `adjustStock` [K] (D-18, BR-24): an admin raises or lowers stock with a required reason; the
 * movement and audit row record who, why and by how much.
 */
@Injectable()
export class AdjustStockService {
  constructor(
    private readonly stock: StockRepository,
    private readonly ledger: StockLedgerService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: AdjustStockInput, viewer: Principal): Promise<ProductView> {
    const hash = requestHashBytes(input);
    const decrease = input.direction === 'DECREASE';
    return runIdempotent({
      keyColumn: 'idempotency_key',
      requestHash: hash,
      replay: () => this.ledger.replay(input.idempotencyKey),
      execute: () =>
        this.uow.run(async () => {
          await this.stock.lockActive(input.productId);
          const view = await this.ledger.apply({
            productId: input.productId,
            type: decrease ? 'ADJUSTMENT_DECREASE' : 'ADJUSTMENT_INCREASE',
            quantityPieces: decrease ? -input.quantityPieces : input.quantityPieces,
            reason: input.reason,
            note: input.note,
            actorUserId: viewer.userId,
            idempotencyKey: input.idempotencyKey,
            requestHash: hash,
          });
          await this.audit.record('stock.adjusted', viewer.userId, {
            entityType: 'product',
            entityId: input.productId,
            metadata: {
              direction: input.direction,
              pieces: input.quantityPieces,
              reason: input.reason,
              stockAfter: view.stockPieces,
            },
          });
          return view;
        }),
    });
  }
}
