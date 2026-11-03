import { LEGACY, type LegacyEntity } from './schema-map.js';

import type pg from 'pg';

export interface SchemaCheck {
  /** Missing tables or required columns: the migration cannot run. */
  problems: string[];
  /** Missing optional columns: the migration runs without them. */
  notes: string[];
  /** `table.column` → its PostgreSQL data type, for every mapped column that exists. */
  types: Map<string, string>;
}

/**
 * Compares `schema-map.ts` with the old database (`information_schema`, names and types only; no data
 * is read). For a table with missing columns it lists the columns that do exist, so the map can be
 * corrected in one step.
 */
export async function checkLegacySchema(legacy: pg.Client): Promise<SchemaCheck> {
  const { rows } = await legacy.query<{ table: string; column: string; type: string }>(
    `SELECT table_name AS table, column_name AS column, data_type AS type
     FROM information_schema.columns WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`,
  );
  const tables = new Map<string, Map<string, string>>();
  for (const row of rows) {
    const columns = tables.get(row.table) ?? new Map<string, string>();
    columns.set(row.column, row.type);
    tables.set(row.table, columns);
  }
  const check: SchemaCheck = { problems: [], notes: [], types: new Map() };
  for (const entity of Object.keys(LEGACY) as LegacyEntity[]) {
    const { table, columns } = LEGACY[entity];
    const actual = tables.get(table);
    if (actual === undefined) {
      check.problems.push(`Table "${table}" not found.`);
      continue;
    }
    const missing: string[] = [];
    for (const spec of Object.values(columns)) {
      const type = actual.get(spec.column);
      if (type !== undefined) {
        check.types.set(`${table}.${spec.column}`, type);
      } else if (spec.optional === true) {
        check.notes.push(`${table}.${spec.column} not found (optional; migrated without it).`);
      } else {
        missing.push(spec.column);
      }
    }
    if (missing.length > 0) {
      check.problems.push(
        `${table}: missing ${missing.join(', ')}. Columns that exist: ${[...actual.keys()].join(', ')}.`,
      );
    }
  }
  return check;
}
