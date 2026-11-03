import { SEARCH_MIN_CHARS } from '@pos/contracts';
import { normalizeNameKey, phoneDigits } from '@pos/domain';

import { AppError } from '../../../common/errors/app-error';
import { decodeCursor, encodeCursor } from '../../../common/pagination/cursor.codec';
import { keysetWhere, type KeysetSort } from '../../../common/pagination/keyset';

import type { LedgerRow, LedgerWindow, PartyFilter } from './party-store';

/** Party lists: name order, then id (index `<table>_active_name_idx`). */
export const PARTY_SORT: KeysetSort = { name: 'NAME_ASC', field: 'nameKey', direction: 'asc' };

const LEDGER_SORT = 'CREATED_DESC';

/** Phone digits searched only from 3 digits on, so short numbers in names do not match every phone. */
const MIN_PHONE_DIGITS = 3;

/** Shared `where` for both party tables: search name or phone digits, balance and archive filters. */
export function partyWhere(filter: PartyFilter, after: string | null | undefined) {
  const search = filter.search ?? null;
  const digits = search === null ? null : phoneDigits(search);
  const terms = [
    ...(search !== null && search.length >= SEARCH_MIN_CHARS
      ? [{ nameKey: { contains: normalizeNameKey(search) } }]
      : []),
    ...(digits !== null && digits.length >= MIN_PHONE_DIGITS
      ? [{ phoneDigits: { contains: digits } }]
      : []),
  ];
  const cursor = keysetWhere(PARTY_SORT, after);
  return {
    ...(filter.includeArchived === true ? {} : { archivedAt: null }),
    ...(filter.withBalanceOnly === true ? { NOT: { balance: 0 } } : {}),
    ...(search === null ? {} : { OR: terms.length > 0 ? terms : [{ id: { in: [] } }] }),
    ...(cursor === undefined ? {} : { AND: [cursor] }),
  };
}

/** Decodes a ledger cursor (created_at, bigint id); anything malformed is BAD_CURSOR. */
export function ledgerCursor(after: string | null | undefined): LedgerWindow['cursor'] {
  if (after === null || after === undefined) {
    return null;
  }
  const { key, id } = decodeCursor(after, LEDGER_SORT);
  const createdAt = new Date(String(key));
  if (Number.isNaN(createdAt.getTime()) || !/^\d+$/.test(id)) {
    throw new AppError(
      'BAD_CURSOR',
      'This page link is no longer valid. Start from the first page.',
    );
  }
  return { createdAt, id: BigInt(id) };
}

/** Ledger `where`: one party, the archive window, rows strictly after the cursor (newest first). */
export function ledgerWhere(
  partyField: 'customerId' | 'vendorId',
  partyId: string,
  window: LedgerWindow,
) {
  const { cursor, since } = window;
  return {
    [partyField]: partyId,
    ...(since === null ? {} : { createdAt: { gte: since } }),
    ...(cursor === null
      ? {}
      : {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }),
  };
}

export const LEDGER_ORDER = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

/** The cursor of a ledger row, for `pageInfo.endCursor`. */
export function ledgerEndCursor(row: Pick<LedgerRow, 'createdAt' | 'id'>): string {
  return encodeCursor(LEDGER_SORT, row.createdAt.toISOString(), row.id.toString());
}
