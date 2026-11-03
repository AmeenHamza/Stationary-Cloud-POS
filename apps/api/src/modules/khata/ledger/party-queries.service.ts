import { Injectable } from '@nestjs/common';

import { ARCHIVE_WINDOW_DAYS } from '@pos/contracts';

import { PageInfo, type ConnectionValue } from '../../../common/pagination/connection.factory';
import { toConnection } from '../../../common/pagination/keyset';
import { ClockService } from '../../../common/time/clock.service';
import { dateColumn } from '../../../common/time/date-column';

import { ledgerCursor, ledgerEndCursor, PARTY_SORT } from './party-where';

import type { LedgerRow, PartyFilter, PartyRow, PartyStore } from './party-store';

const DAY_MS = 86_400_000;

/** A ledger entry as GraphQL renders it: string id, `YYYY-MM-DD` business date. */
export type LedgerEntryView<Entry extends LedgerRow> = Omit<Entry, 'id' | 'businessDate'> & {
  id: string;
  businessDate: string;
};

export function toEntryView<Entry extends LedgerRow>(row: Entry): LedgerEntryView<Entry> {
  return {
    ...row,
    id: row.id.toString(),
    businessDate: dateColumn(row.businessDate),
  };
}

/**
 * Reads shared by customers and vendors (API.md §6.1): name-ordered keyset lists and newest-first
 * ledgers limited to the last 90 days unless `includeArchived` (D-12, F-35). Totals are COUNTs run
 * only when selected; balances are columns, never sums of a page.
 */
@Injectable()
export class PartyQueries {
  constructor(private readonly clock: ClockService) {}

  async list<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    args: {
      filter?: PartyFilter | null | undefined;
      first: number;
      after?: string | null | undefined;
    },
  ): Promise<ConnectionValue<Row>> {
    const filter = args.filter ?? {};
    const rows = await store.list(filter, args.first + 1, args.after);
    return toConnection(
      rows,
      args.first,
      PARTY_SORT,
      (row) => row.nameKey,
      () => store.count(filter),
    );
  }

  async ledger<Row extends PartyRow, Data, Entry extends LedgerRow>(
    store: PartyStore<Row, Data, Entry>,
    partyId: string,
    args: {
      first: number;
      after?: string | null | undefined;
      includeArchived?: boolean | null | undefined;
    },
  ): Promise<ConnectionValue<LedgerEntryView<Entry>>> {
    const since =
      args.includeArchived === true
        ? null
        : new Date(this.clock.now().getTime() - ARCHIVE_WINDOW_DAYS * DAY_MS);
    const rows = await store.listEntries(partyId, {
      since,
      take: args.first + 1,
      cursor: ledgerCursor(args.after),
    });
    const nodes = rows.slice(0, args.first);
    const last = nodes.at(-1);
    const pageInfo = new PageInfo();
    pageInfo.hasNextPage = rows.length > args.first;
    pageInfo.endCursor = last === undefined ? null : ledgerEndCursor(last);
    return {
      nodes: nodes.map(toEntryView),
      pageInfo,
      loadTotalCount: () => store.countEntries(partyId, since),
    };
  }
}
