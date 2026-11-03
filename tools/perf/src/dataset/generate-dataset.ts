import path from 'node:path';

import pg from 'pg';

import { createTestDatabase, migrateDatabase, type TestDatabase } from '@pos/testkit';

import { DATASET } from '../config.js';

import { HISTORY_SQL, type HistoryParameter } from './history-sql.js';
import { insertCatalog, insertParties, insertUsers } from './insert-catalog.js';

const PARAMETERS: Readonly<Record<HistoryParameter, number>> = {
  days: DATASET.historyDays,
  billsPerDay: DATASET.billsPerHistoryDay,
  udhaarShare: DATASET.udhaarShare,
};

export interface DatasetSummary {
  products: number;
  customers: number;
  vendors: number;
  orders: number;
  orderLines: number;
  seconds: number;
}

/**
 * A fresh, migrated `perf_*` database with the §8.1 dataset (local services only: the base URL comes
 * from `TEST_DATABASE_URL`, like the test suites). Returns it with a summary of what was loaded.
 */
export async function generateDataset(
  repoRoot: string,
  baseUrl: string,
): Promise<{ db: TestDatabase; summary: DatasetSummary }> {
  const started = Date.now();
  const db = await createTestDatabase(baseUrl, { prefix: 'perf' });
  migrateDatabase(path.join(repoRoot, 'packages', 'database'), db.url);
  const client = new pg.Client({ connectionString: db.url });
  await client.connect();
  try {
    await insertUsers(client);
    await insertCatalog(client);
    await insertParties(client);
    await client.query('SELECT setseed($1)', [DATASET.seed]);
    for (const [sql, names] of HISTORY_SQL) {
      await client.query(
        sql,
        names.map((name) => PARAMETERS[name]),
      );
    }
    const { rows } = await client.query<Omit<DatasetSummary, 'seconds'>>(
      `SELECT (SELECT count(*) FROM products)::int AS products,
              (SELECT count(*) FROM customers)::int AS customers,
              (SELECT count(*) FROM vendors)::int AS vendors,
              (SELECT count(*) FROM orders)::int AS orders,
              (SELECT count(*) FROM order_lines)::int AS "orderLines"`,
    );
    const counts = rows[0];
    if (counts === undefined) {
      throw new Error('dataset counts missing');
    }
    return { db, summary: { ...counts, seconds: Math.round((Date.now() - started) / 1_000) } };
  } finally {
    await client.end();
  }
}
