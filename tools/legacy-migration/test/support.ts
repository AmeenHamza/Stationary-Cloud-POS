import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll } from 'vitest';

import { DEFAULT_BUSINESS_TIMEZONE } from '@pos/contracts';
import {
  createTestDatabase,
  migrateDatabase,
  querySql,
  requireTestEnv,
  type TestDatabase,
} from '@pos/testkit';

import { dryRun } from '../src/commands/dry-run.js';
import { TOOL_ROOT, type MigrationConfig } from '../src/config.js';
import { RunLog } from '../src/log.js';

const DATABASE_PACKAGE = path.resolve(TOOL_ROOT, '..', '..', 'packages', 'database');

const fixture = (name: string): string =>
  readFileSync(path.join(TOOL_ROOT, 'test', 'fixtures', name), 'utf8');

/** A local old database (the production schema with invented data) and an empty, migrated new one. */
export interface Fixture {
  legacy: TestDatabase;
  target: TestDatabase;
  config: MigrationConfig;
  /** Quiet: run logs go to the run folder only. */
  log: RunLog;
  drop: () => Promise<void>;
}

/** An empty new database with every Prisma migration applied (local only). */
export async function emptyTarget(): Promise<TestDatabase> {
  const target = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), {
    prefix: 'mig_new',
  });
  migrateDatabase(DATABASE_PACKAGE, target.url);
  return target;
}

export async function createFixture(): Promise<Fixture> {
  const legacy = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), {
    prefix: 'mig_old',
  });
  await querySql(legacy.url, fixture('legacy-schema.sql'));
  await querySql(legacy.url, fixture('legacy-data.sql'));
  const target = await emptyTarget();
  const config: MigrationConfig = {
    legacyUrl: legacy.url,
    targetUrl: target.url,
    batchSize: 4, // small, so every table is read and written in several batches
    outDir: mkdtempSync(path.join(os.tmpdir(), 'pos-migration-')),
    naiveZone: 'UTC',
    timeZone: DEFAULT_BUSINESS_TIMEZONE,
  };
  return {
    legacy,
    target,
    config,
    log: new RunLog(false),
    drop: async () => {
      await legacy.drop();
      await target.drop();
    },
  };
}

/**
 * Registers the test file's hooks: a fresh fixture and the fingerprint of its dry run before the first
 * test, and both databases dropped after the last. The returned object is filled in by then.
 */
export function useFixture(): { f: Fixture; fingerprint: string } {
  const state = {} as { f: Fixture; fingerprint: string };
  beforeAll(async () => {
    state.f = await createFixture();
    state.fingerprint = (await dryRun(state.f.config, state.f.log)).fingerprint ?? '';
  });
  afterAll(async () => {
    await state.f.drop();
  });
  return state;
}

/** Rows per business table in the new database. */
export async function targetCounts(url: string): Promise<Record<string, number>> {
  const tables = [
    'categories',
    'products',
    'stock_movements',
    'customers',
    'vendors',
    'orders',
    'order_lines',
    'refunds',
    'refund_lines',
    'customer_ledger_entries',
    'vendor_ledger_entries',
    'bill_number_counters',
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await querySql<{ n: number }>(url, `SELECT count(*)::int AS n FROM ${table}`);
    counts[table] = row?.n ?? -1;
  }
  return counts;
}

/** What the fixture must become (test/fixtures/legacy-data.sql). */
export const PLANNED = {
  categories: 2,
  products: 6,
  stock_movements: 5,
  customers: 2,
  vendors: 2,
  orders: 6,
  order_lines: 9,
  refunds: 3,
  refund_lines: 3,
  customer_ledger_entries: 6,
  vendor_ledger_entries: 3,
  bill_number_counters: 3,
};

export const EMPTY = Object.fromEntries(Object.keys(PLANNED).map((table) => [table, 0]));
