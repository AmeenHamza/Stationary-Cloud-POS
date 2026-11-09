import type pg from 'pg';

/** One target table's insert: its columns and what makes a row "already there". */
export interface InsertSpec {
  table: string;
  columns: readonly string[];
  /** The ON CONFLICT target, e.g. `(id)`: only an already-migrated row is skipped, not other clashes. */
  conflict: string;
  /** Columns to return for the rows actually inserted (none when empty). */
  returning?: string;
}

export type Cell = string | number | boolean | Date | null;

export interface InsertResult<R> {
  planned: number;
  inserted: number;
  /** The `returning` columns of the inserted rows (skipped rows return nothing). */
  rows: R[];
}

/** PostgreSQL allows 65,535 parameters per statement; stay well below. */
const MAX_PARAMETERS = 60_000;

/**
 * Inserts `rows` in batches (multi-row INSERT with bind parameters, never string-built values),
 * skipping rows that already exist (`ON CONFLICT … DO NOTHING`). Runs inside the caller's transaction.
 */
export async function insertRows<R extends Record<string, unknown> = Record<string, unknown>>(
  client: pg.ClientBase,
  spec: InsertSpec,
  rows: readonly (readonly Cell[])[],
  batchSize: number,
): Promise<InsertResult<R>> {
  const width = spec.columns.length;
  const perStatement = Math.max(1, Math.min(batchSize, Math.floor(MAX_PARAMETERS / width)));
  const result: InsertResult<R> = { planned: rows.length, inserted: 0, rows: [] };
  const head = `INSERT INTO "${spec.table}" (${spec.columns.map((c) => `"${c}"`).join(', ')}) VALUES `;
  const tail =
    ` ON CONFLICT ${spec.conflict} DO NOTHING` +
    (spec.returning === undefined ? '' : ` RETURNING ${spec.returning}`);
  for (let start = 0; start < rows.length; start += perStatement) {
    const batch = rows.slice(start, start + perStatement);
    const values: Cell[] = [];
    const tuples = batch.map((row) => {
      if (row.length !== width) {
        throw new Error(
          `${spec.table}: a row has ${String(row.length)} values for ${String(width)} columns`,
        );
      }
      const marks = row.map((cell) => {
        values.push(cell);
        return `$${String(values.length)}`;
      });
      return `(${marks.join(', ')})`;
    });
    const response = await client.query<R>(`${head}${tuples.join(', ')}${tail}`, values);
    result.inserted += response.rowCount ?? 0;
    result.rows.push(...response.rows);
  }
  return result;
}

/** Money and rates as exact text for `numeric` columns. */
export const fixed = (value: { toFixed: (digits: number) => string } | null): string | null =>
  value === null ? null : value.toFixed(2);
