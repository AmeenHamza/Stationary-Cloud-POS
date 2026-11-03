import { PageInfo, type ConnectionValue } from './connection.factory';
import { decodeCursor, encodeCursor, type CursorKey } from './cursor.codec';

/** A list's sort: one column plus `id` as the tiebreaker, both in the same direction. */
export interface KeysetSort {
  /** Stable name used inside cursors, e.g. 'NAME_ASC'. */
  name: string;
  field: string;
  direction: 'asc' | 'desc';
}

/** Prisma `where` fragment for rows strictly after the cursor: (field, id) > (key, id). */
export function keysetWhere(
  sort: KeysetSort,
  after: string | null | undefined,
): object | undefined {
  if (after === undefined || after === null) {
    return undefined;
  }
  const { key, id } = decodeCursor(after, sort.name);
  const op = sort.direction === 'asc' ? 'gt' : 'lt';
  return { OR: [{ [sort.field]: { [op]: key } }, { [sort.field]: key, id: { [op]: id } }] };
}

/** Prisma `orderBy` matching the keyset: sort column, then id. */
export function keysetOrderBy(sort: KeysetSort): object[] {
  return [{ [sort.field]: sort.direction }, { id: sort.direction }];
}

/**
 * Turns `first + 1` fetched rows into a page: drops the probe row, sets `hasNextPage` and the
 * cursor of the last returned row (ADR-017: never OFFSET).
 */
export function toConnection<T extends { id: string }>(
  rows: readonly T[],
  first: number,
  sort: KeysetSort,
  keyOf: (row: T) => CursorKey,
  loadTotalCount?: () => Promise<number>,
): ConnectionValue<T> {
  const nodes = rows.slice(0, first);
  const last = nodes.at(-1);
  const pageInfo = new PageInfo();
  pageInfo.hasNextPage = rows.length > first;
  pageInfo.endCursor = last === undefined ? null : encodeCursor(sort.name, keyOf(last), last.id);
  return { nodes, pageInfo, ...(loadTotalCount === undefined ? {} : { loadTotalCount }) };
}
