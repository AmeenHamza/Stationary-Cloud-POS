import { readdirSync } from 'node:fs';
import path from 'node:path';

import { TOOL_ROOT } from '../config.js';

import type pg from 'pg';

/** Business tables, with the condition that marks a row the migration did not write. */
const FOREIGN_ROWS: Readonly<Record<string, string>> = {
  categories: 'legacy_id IS NULL',
  products: 'legacy_id IS NULL',
  customers: 'legacy_id IS NULL',
  vendors: 'legacy_id IS NULL',
  orders: 'legacy_id IS NULL',
  customer_ledger_entries: 'legacy_id IS NULL',
  vendor_ledger_entries: 'legacy_id IS NULL',
  stock_movements: "type <> 'MIGRATION'",
  import_jobs: 'true',
};

/** Rows an earlier run of this migration wrote (a re-run skips them). */
const MIGRATED_ROWS = [
  'categories',
  'products',
  'customers',
  'vendors',
  'orders',
  'customer_ledger_entries',
  'vendor_ledger_entries',
] as const;

export interface Preflight {
  /** Anything here stops `apply`. */
  problems: string[];
  /** Rows written by an earlier run, per table. */
  migrated: Record<string, number>;
}

/** The repository's migrations: the new database must have every one applied. */
function expectedMigrations(): string[] {
  const dir = path.resolve(TOOL_ROOT, '..', '..', 'packages', 'database', 'prisma', 'migrations');
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function count(client: pg.ClientBase, table: string, where: string): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
  );
  return rows[0]?.n ?? 0;
}

/**
 * Checks the new database before writing (MAPPING.md §8): every migration applied, and no business
 * data the migration did not write. Merging old bills into a system already in use needs its own plan
 * (bill numbers, barcodes, balances), so that is refused rather than attempted. Reads only.
 */
export async function preflight(client: pg.ClientBase): Promise<Preflight> {
  const problems: string[] = [];
  const { rows } = await client.query<{ name: string }>(
    `SELECT migration_name AS name FROM _prisma_migrations
     WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  const applied = new Set(rows.map((row) => row.name));
  const missing = expectedMigrations().filter((name) => !applied.has(name));
  if (missing.length > 0) {
    problems.push(
      `The new database is missing ${String(missing.length)} migration(s) (${missing.join(', ')}). ` +
        'Run `pnpm --filter @pos/database migrate:deploy` against it first.',
    );
  }
  for (const [table, where] of Object.entries(FOREIGN_ROWS)) {
    const foreign = await count(client, table, where);
    if (foreign > 0) {
      problems.push(
        `${table} has ${String(foreign)} row(s) the migration did not write. ` +
          'The migration only runs into a new database that is empty or holds only migrated data.',
      );
    }
  }
  const migrated: Record<string, number> = {};
  for (const table of MIGRATED_ROWS) {
    migrated[table] = await count(client, table, 'legacy_id IS NOT NULL');
  }
  return { problems, migrated };
}
