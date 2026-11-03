import { Injectable } from '@nestjs/common';

import { ledgerDelta, toMoneyString } from '@pos/domain';

import { moneyText } from '../../../common/graphql/scalars';
import { runIdempotent } from '../../../common/idempotency/idempotent-replay';
import { OutboxService } from '../../../infrastructure/realtime/outbox.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService, type AuditAction } from '../../audit';

import { mapPartyErrors } from './party-errors';

import type { LedgerRow, PartyRow, PartyStore } from './party-store';
import type { PaymentMethod } from '@pos/contracts';

/** One khata entry to post: `amount` is positive; `raisesBalance` gives the sign. */
export interface Posting {
  partyId: string;
  type: string;
  amount: string;
  raisesBalance: boolean;
  paymentMethod: PaymentMethod | null;
  note: string | null;
  orderId?: string | null;
  refundId?: string | null;
  /** Payments and manual entries need an active party; refund credits reach archived ones too. */
  requireActive: boolean;
  idempotencyKey: string | null;
  requestHash: Uint8Array<ArrayBuffer> | null;
  /** Sales are not audited (the order is the record); manual khata entries are. */
  audit: AuditAction | null;
}

/**
 * Posts khata entries (DATABASE.md §4.8, §6): `balance = balance + delta` in one statement under
 * the row lock it takes, then the entry with that `balance_after`, the `<kind>.balanceChanged`
 * event and the audit row, all in the caller's transaction (joined if one is open, e.g. a sale).
 * Concurrent postings on one party serialize on the row, so running balances chain (FIN-21).
 */
@Injectable()
export class LedgerPosting {
  constructor(
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  post<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    posting: Posting,
    actorUserId: string | null,
  ): Promise<Row> {
    return mapPartyErrors(store.kind, 'NOT_FOUND', () =>
      this.uow.run(async () => {
        const delta = toMoneyString(ledgerDelta(posting.amount, posting.raisesBalance));
        const party = await store.applyDelta(posting.partyId, delta, posting.requireActive);
        await store.insertEntry({
          partyId: posting.partyId,
          type: posting.type,
          amount: delta,
          balanceAfter: party.balance.toString(),
          paymentMethod: posting.paymentMethod,
          note: posting.note,
          orderId: posting.orderId ?? null,
          refundId: posting.refundId ?? null,
          idempotencyKey: posting.idempotencyKey,
          requestHash: posting.requestHash,
          actorUserId,
        });
        await this.outbox.add(`${store.kind}.balanceChanged`, 'staff', {
          [`${store.kind}Id`]: party.id,
          balance: moneyText(party.balance),
          version: party.version,
        });
        if (posting.audit !== null) {
          await this.audit.record(posting.audit, actorUserId, {
            entityType: store.kind,
            entityId: party.id,
            metadata: { type: posting.type, amount: delta },
          });
        }
        return party;
      }),
    );
  }

  /** A manual entry with its own idempotency key [K]: a retry returns the party, applied once. */
  postOnce<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    posting: Posting & { idempotencyKey: string; requestHash: Uint8Array<ArrayBuffer> },
    actorUserId: string,
  ): Promise<Row> {
    return runIdempotent({
      keyColumn: 'idempotency_key',
      requestHash: posting.requestHash,
      execute: () => this.post(store, posting, actorUserId),
      replay: async () => {
        const found = await store.findEntryByKey(posting.idempotencyKey);
        const party = found && (await store.findById(found.partyId));
        return found && party && { requestHash: found.requestHash, result: party };
      },
    });
  }
}
