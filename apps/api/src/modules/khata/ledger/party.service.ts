import { requestHashBytes } from '../../../common/idempotency/request-hash';

import type { LedgerPosting, Posting } from './ledger-posting.service';
import type { PartyCommands } from './party-commands.service';
import type { PartyQueries } from './party-queries.service';
import type { LedgerRow, PartyFilter, PartyRow, PartyStore } from './party-store';
import type { Principal } from '../../../common/auth/principal';

/** The shared services every party kind uses. */
export interface PartyDeps {
  queries: PartyQueries;
  commands: PartyCommands;
  posting: LedgerPosting;
}

export interface PageRequest {
  first: number;
  after?: string | null | undefined;
}

/**
 * What customers and vendors share (F-25, F-26): lists, ledgers, create, update, archive. Each kind
 * extends it with its store, its contact mapping and its own entry types.
 */
export abstract class PartyService<Row extends PartyRow, Data, Entry extends LedgerRow, Input> {
  private readonly queries: PartyQueries;
  private readonly commands: PartyCommands;
  protected readonly posting: LedgerPosting;

  protected constructor(
    protected readonly store: PartyStore<Row, Data, Entry>,
    deps: PartyDeps,
  ) {
    this.queries = deps.queries;
    this.commands = deps.commands;
    this.posting = deps.posting;
  }

  /** Store columns for a validated create or update input. */
  protected abstract toData(input: Input): Data;

  list(args: PageRequest & { filter?: PartyFilter | null | undefined }) {
    return this.queries.list(this.store, args);
  }

  byId(id: string): Promise<Row | null> {
    return this.store.findById(id);
  }

  ledger(partyId: string, args: PageRequest & { includeArchived?: boolean | null | undefined }) {
    return this.queries.ledger(this.store, partyId, args);
  }

  create(input: Input, viewer: Principal): Promise<Row> {
    return this.commands.create(this.store, this.toData(input), viewer);
  }

  update(input: Input & { id: string; version: number }, viewer: Principal): Promise<Row> {
    return this.commands.update(this.store, input, this.toData(input), viewer);
  }

  archive(id: string, viewer: Principal): Promise<Row> {
    return this.commands.setArchived(this.store, id, true, viewer);
  }

  restore(id: string, viewer: Principal): Promise<Row> {
    return this.commands.setArchived(this.store, id, false, viewer);
  }

  delete(id: string, viewer: Principal): Promise<boolean> {
    return this.commands.delete(this.store, id, viewer);
  }

  /** A manual khata entry [K] on an active party; the request hash covers the whole input. */
  protected postManual(
    partyId: string,
    input: { idempotencyKey: string; amount: string },
    viewer: Principal,
    entry: Pick<Posting, 'type' | 'raisesBalance' | 'paymentMethod' | 'note' | 'audit'>,
  ): Promise<Row> {
    return this.posting.postOnce(
      this.store,
      {
        ...entry,
        partyId,
        amount: input.amount,
        requireActive: true,
        idempotencyKey: input.idempotencyKey,
        requestHash: requestHashBytes(input),
      },
      viewer.userId,
    );
  }
}
