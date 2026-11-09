import { LEGACY, type LegacyEntity, type LegacyRow } from './schema-map.js';

import type { SchemaCheck } from './schema-check.js';
import type pg from 'pg';

/** Every old row the migration needs, per entity, in id order. */
export type LegacyData = { readonly [E in LegacyEntity]: readonly LegacyRow<E>[] };

/** `to_char` format for a UTC instant to the millisecond; the new side is read back the same way. */
export const ISO_UTC = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

const quote = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

/**
 * The select list for one table: each mapped column as text under its field name. Timestamps are
 * converted to UTC in PostgreSQL (to the millisecond, the new columns' precision); naive timestamps
 * are read in `naiveZone` (the old app's clock).
 */
function selectList(entity: LegacyEntity, check: SchemaCheck, naiveZone: string): string {
  const { table, columns } = LEGACY[entity];
  return Object.entries(columns)
    .map(([field, spec]) => {
      const type = check.types.get(`${table}.${spec.column}`);
      const name = quote(spec.column);
      let value = `${name}::text`;
      if (type === 'timestamp with time zone') {
        value = `to_char(${name} AT TIME ZONE 'UTC', ${ISO_UTC})`;
      } else if (type === 'timestamp without time zone') {
        value = `to_char((${name} AT TIME ZONE '${naiveZone}') AT TIME ZONE 'UTC', ${ISO_UTC})`;
      } else if (type === 'date') {
        value = `to_char(${name}, 'YYYY-MM-DD"T"00:00:00.000"Z"')`;
      }
      return `${value} AS ${quote(field)}`;
    })
    .join(', ');
}

/** Reads one table in keyset batches by id (DATABASE.md §11 step 3); read-only. */
async function readTable<E extends LegacyEntity>(
  legacy: pg.ClientBase,
  entity: E,
  options: ReadOptions,
): Promise<LegacyRow<E>[]> {
  const { table, columns } = LEGACY[entity];
  const id = quote(columns.id.column);
  const sql = `SELECT ${selectList(entity, options.check, options.naiveZone)} FROM ${quote(table)}
               WHERE ${id}::bigint > $1::bigint ORDER BY ${id}::bigint LIMIT ${String(options.batchSize)}`;
  const rows: LegacyRow<E>[] = [];
  let after = '0';
  for (;;) {
    const page = await legacy.query<LegacyRow<E> & { id: string }>(sql, [after]);
    rows.push(...page.rows);
    const last = page.rows.at(-1);
    if (page.rows.length < options.batchSize || last === undefined) {
      return rows;
    }
    after = last.id;
  }
}

export interface ReadOptions {
  check: SchemaCheck;
  naiveZone: string;
  batchSize: number;
}

/**
 * Reads every mapped table. The caller holds one REPEATABLE READ, READ ONLY transaction around this
 * and the verification, so all tables come from the same moment while the old app may still be in use.
 */
export async function readLegacy(legacy: pg.ClientBase, options: ReadOptions): Promise<LegacyData> {
  const read = <E extends LegacyEntity>(entity: E) => readTable(legacy, entity, options);
  return {
    categories: await read('categories'),
    products: await read('products'),
    customers: await read('customers'),
    vendors: await read('vendors'),
    customerTransactions: await read('customerTransactions'),
    vendorTransactions: await read('vendorTransactions'),
    orders: await read('orders'),
    orderItems: await read('orderItems'),
    orderPayments: await read('orderPayments'),
    users: await read('users'),
    systemSettings: await read('systemSettings'),
  };
}

/** Rows per old table, counted in the same snapshot: proves the reader missed nothing. */
export async function countLegacyRows(
  legacy: pg.ClientBase,
): Promise<Record<LegacyEntity, number>> {
  const counts = {} as Record<LegacyEntity, number>;
  for (const entity of Object.keys(LEGACY) as LegacyEntity[]) {
    const { rows } = await legacy.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${quote(LEGACY[entity].table)}`,
    );
    counts[entity] = rows[0]?.n ?? 0;
  }
  return counts;
}
