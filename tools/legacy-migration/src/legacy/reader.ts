import { LEGACY, type LegacyEntity, type LegacyRow } from './schema-map.js';

import type { SchemaCheck } from './schema-check.js';
import type pg from 'pg';

/** Every old row the migration needs, per entity, in id order. */
export type LegacyData = { readonly [E in LegacyEntity]: readonly LegacyRow<E>[] };

const BATCH = 500;
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

const quote = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

/**
 * The select list for one table: each mapped column as text under its field name. Timestamps are
 * converted to UTC in PostgreSQL; naive timestamps are read in `naiveZone` (the old app's clock).
 * Optional columns the database does not have are read as NULL.
 */
function selectList(entity: LegacyEntity, check: SchemaCheck, naiveZone: string): string {
  const { table, columns } = LEGACY[entity];
  return Object.entries(columns)
    .map(([field, spec]) => {
      const type = check.types.get(`${table}.${spec.column}`);
      const name = quote(spec.column);
      let value = `${name}::text`;
      if (type === undefined) {
        value = 'NULL::text';
      } else if (type === 'timestamp with time zone') {
        value = `to_char(${name} AT TIME ZONE 'UTC', ${ISO})`;
      } else if (type === 'timestamp without time zone') {
        value = `to_char((${name} AT TIME ZONE '${naiveZone}') AT TIME ZONE 'UTC', ${ISO})`;
      } else if (type === 'date') {
        value = `to_char(${name}, 'YYYY-MM-DD"T"00:00:00.000"Z"')`;
      }
      return `${value} AS ${quote(field)}`;
    })
    .join(', ');
}

/** Reads one table in keyset batches of 500 by id (DATABASE.md §11 step 3); read-only. */
async function readTable<E extends LegacyEntity>(
  legacy: pg.Client,
  entity: E,
  check: SchemaCheck,
  naiveZone: string,
): Promise<LegacyRow<E>[]> {
  const { table, columns } = LEGACY[entity];
  const id = quote(columns.id.column);
  const sql = `SELECT ${selectList(entity, check, naiveZone)} FROM ${quote(table)}
               WHERE ${id}::bigint > $1::bigint ORDER BY ${id}::bigint LIMIT ${String(BATCH)}`;
  const rows: LegacyRow<E>[] = [];
  let after = '0';
  for (;;) {
    const page = await legacy.query<LegacyRow<E> & { id: string }>(sql, [after]);
    rows.push(...page.rows);
    const last = page.rows.at(-1);
    if (page.rows.length < BATCH || last === undefined) {
      return rows;
    }
    after = last.id;
  }
}

export async function readLegacy(
  legacy: pg.Client,
  check: SchemaCheck,
  naiveZone: string,
): Promise<LegacyData> {
  const read = <E extends LegacyEntity>(entity: E) => readTable(legacy, entity, check, naiveZone);
  await legacy.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
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
