import type { DecimalLike } from '../../../common/graphql/scalars';
import type { PaymentMethod } from '@pos/contracts';

/** Customers and vendors share one khata model (DATABASE.md §4.7–4.8); the store hides the table. */
export type PartyKind = 'customer' | 'vendor';

/** Columns every party read returns, whichever table. */
export interface PartyRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: DecimalLike;
  archivedAt: Date | null;
  version: number;
  createdAt: Date;
}

/** Contact columns written by create and update; `nameKey`/`phoneDigits` are derived. */
export interface PartyContact {
  name: string;
  nameKey: string;
  phone: string | null;
  phoneDigits: string | null;
  email: string | null;
  address: string | null;
}

export interface PartyFilter {
  search?: string | null | undefined;
  withBalanceOnly?: boolean | null | undefined;
  includeArchived?: boolean | null | undefined;
}

/** Columns every ledger entry read returns (customer entries add order and refund ids). */
export interface LedgerRow {
  id: bigint;
  type: string;
  amount: DecimalLike;
  balanceAfter: DecimalLike;
  paymentMethod: PaymentMethod | null;
  note: string | null;
  businessDate: Date;
  createdAt: Date;
}

export interface NewLedgerEntry {
  partyId: string;
  type: string;
  amount: string;
  balanceAfter: string;
  paymentMethod: PaymentMethod | null;
  note: string | null;
  orderId?: string | null;
  refundId?: string | null;
  idempotencyKey: string | null;
  requestHash: Uint8Array<ArrayBuffer> | null;
  actorUserId: string | null;
}

/** One ledger page window: since (null = all, F-35), page size + 1 and the decoded cursor. */
export interface LedgerWindow {
  since: Date | null;
  take: number;
  cursor: { createdAt: Date; id: bigint } | null;
}

/**
 * Persistence of one party kind. The shared services (queries, commands, posting) work through it,
 * so customer and vendor khata logic exists once (rule 4).
 */
export interface PartyStore<Row extends PartyRow, Data, Entry extends LedgerRow> {
  readonly kind: PartyKind;
  list: (
    filter: PartyFilter,
    take: number,
    after: string | null | undefined,
  ) => Promise<(Row & { nameKey: string })[]>;
  count: (filter: PartyFilter) => Promise<number>;
  findById: (id: string) => Promise<Row | null>;
  insert: (data: Data) => Promise<Row>;
  update: (id: string, version: number, data: Data) => Promise<Row>;
  setArchivedAt: (id: string, version: number, archivedAt: Date | null) => Promise<Row>;
  /** `balance = balance + delta` in one statement; `requireActive` refuses archived parties. */
  applyDelta: (id: string, delta: string, requireActive: boolean) => Promise<Row>;
  insertEntry: (entry: NewLedgerEntry) => Promise<void>;
  findEntryByKey: (key: string) => Promise<{ requestHash: Uint8Array; partyId: string } | null>;
  listEntries: (partyId: string, window: LedgerWindow) => Promise<Entry[]>;
  countEntries: (partyId: string, since: Date | null) => Promise<number>;
}
