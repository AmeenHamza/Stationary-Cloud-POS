import { Injectable } from '@nestjs/common';

import { balanceState, normalizeNameKey, phoneDigits } from '@pos/domain';

import { AppError } from '../../../common/errors/app-error';
import { ClockService } from '../../../common/time/clock.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';

import { mapPartyErrors, partyHasHistory, refuseIfReferenced } from './party-errors';

import type { LedgerRow, PartyContact, PartyRow, PartyStore } from './party-store';
import type { Principal } from '../../../common/auth/principal';

/** Contact columns from validated input; `nameKey` and `phoneDigits` drive sort and search. */
export function contactData(input: {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}): PartyContact {
  return {
    name: input.name,
    nameKey: normalizeNameKey(input.name),
    phone: input.phone,
    phoneDigits: phoneDigits(input.phone),
    email: input.email,
    address: input.address,
  };
}

/**
 * Party commands shared by customers and vendors (F-25, F-26): create, update [V], archive, restore
 * and delete. Archiving needs a zero balance (Q33: `BALANCE_NOT_ZERO`). Bills and khata entries are
 * never deleted (D-12), so only a party with neither can be (D-28: `HAS_HISTORY`).
 */
@Injectable()
export class PartyCommands {
  constructor(
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly uow: UnitOfWork,
  ) {}

  create<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    data: Data,
    viewer: Principal,
  ): Promise<Row> {
    return this.uow.run(async () => {
      const row = await store.insert(data);
      await this.audit.record(`${store.kind}.created`, viewer.userId, {
        entityType: store.kind,
        entityId: row.id,
      });
      return row;
    });
  }

  update<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    target: { id: string; version: number },
    data: Data,
    viewer: Principal,
  ): Promise<Row> {
    return mapPartyErrors(store.kind, 'CONFLICT', () =>
      this.uow.run(async () => {
        const row = await store.update(target.id, target.version, data);
        await this.audit.record(`${store.kind}.updated`, viewer.userId, {
          entityType: store.kind,
          entityId: row.id,
        });
        return row;
      }),
    );
  }

  setArchived<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    id: string,
    archive: boolean,
    viewer: Principal,
  ): Promise<Row> {
    return mapPartyErrors(store.kind, 'CONFLICT', () =>
      this.uow.run(async () => {
        const row = await store.findById(id);
        if (row === null) {
          throw new AppError('NOT_FOUND', `This ${store.kind} does not exist.`);
        }
        if ((row.archivedAt !== null) === archive) {
          return row;
        }
        if (archive && balanceState(row.balance.toString()).state !== 'settled') {
          throw new AppError('BALANCE_NOT_ZERO', 'Settle the balance to zero before archiving.');
        }
        // The version read above guards against a payment landing in between (CONFLICT).
        const updated = await store.setArchivedAt(
          id,
          row.version,
          archive ? this.clock.now() : null,
        );
        await this.audit.record(
          `${store.kind}.${archive ? 'archived' : 'restored'}`,
          viewer.userId,
          {
            entityType: store.kind,
            entityId: id,
          },
        );
        return updated;
      }),
    );
  }

  /** Removes the row for good; the version read here guards against an entry landing in between. */
  delete<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    id: string,
    viewer: Principal,
  ): Promise<boolean> {
    return mapPartyErrors(store.kind, 'CONFLICT', () =>
      this.uow.run(async () => {
        const row = await store.findById(id);
        if (row === null) {
          throw new AppError('NOT_FOUND', `This ${store.kind} does not exist.`);
        }
        if (await store.hasHistory(id)) {
          throw partyHasHistory(store.kind);
        }
        await refuseIfReferenced(store.kind, () => store.delete(id, row.version));
        await this.audit.record(`${store.kind}.deleted`, viewer.userId, {
          entityType: store.kind,
          entityId: id,
        });
        return true;
      }),
    );
  }
}
