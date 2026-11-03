import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import pg from 'pg';

import { assertLocalUrl, requireTestEnv } from '@pos/testkit';

import { generateDataset } from './dataset/generate-dataset.js';
import { startPerfApi, WEB_ORIGIN } from './measure/api-server.js';
import { flushLocalRedis, readRedisStats, redisDelta } from './measure/redis-stats.js';
import { checkBudgets, type BudgetFile } from './report/budget-check.js';
import { metricsOf } from './report/metrics.js';
import { operationsOf, writeReport } from './report/report-writer.js';
import { simulateDay } from './scenarios/day-simulation.js';

import type { CatalogSample } from './scenarios/counter-session.js';

/**
 * `pnpm --filter @pos/perf perf [--keep-db]`: the §8 network workload on local services. Builds the
 * dataset, starts the built API behind the byte proxy, simulates a day, writes `perf-report/` and
 * exits 1 if any budget fails (§8.3). Needs `pnpm build` and `pnpm services:up` first.
 */
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const ENV_FILE = path.join(ROOT, 'apps', 'api', '.env');
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE); // TEST_DATABASE_URL and TEST_REDIS_URL on a developer machine
}

async function catalogSample(databaseUrl: string): Promise<CatalogSample> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const products = await client.query<{ barcode: string; name: string }>(
      'SELECT barcode, name FROM products WHERE stock_pieces > 30 ORDER BY barcode LIMIT 400',
    );
    const customers = await client.query<{ name: string }>(
      'SELECT name FROM customers ORDER BY name LIMIT 40',
    );
    return {
      products: products.rows,
      customerSearches: customers.rows.map((row) => row.name.split(' ').slice(1, 3).join(' ')),
    };
  } finally {
    await client.end();
  }
}

const redisUrl = requireTestEnv('TEST_REDIS_URL');
assertLocalUrl(redisUrl);
const { db, summary: dataset } = await generateDataset(ROOT, requireTestEnv('TEST_DATABASE_URL'));
console.log(`dataset ready in ${String(dataset.seconds)} s: ${JSON.stringify(dataset)}`);
const catalog = await catalogSample(db.url);
await flushLocalRedis(redisUrl);
const api = await startPerfApi(ROOT, db.url, redisUrl);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void api.stop().finally(() => process.exit(130)); // never leave the API running
  });
}
const redisBefore = await readRedisStats(redisUrl);
try {
  const day = await simulateDay(api, catalog, WEB_ORIGIN, (message) => {
    console.log(message);
  });
  const metrics = metricsOf(day);
  const budgets = JSON.parse(
    await readFile(path.join(import.meta.dirname, '..', 'budgets.json'), 'utf8'),
  ) as BudgetFile;
  const results = checkBudgets(metrics, budgets);
  const text = await writeReport(path.join(import.meta.dirname, '..', 'perf-report'), {
    generatedAt: new Date(Date.now()).toISOString(),
    dataset,
    metrics,
    budgets: results,
    db: day.db,
    ws: day.ws,
    redis: redisDelta(redisBefore, await readRedisStats(redisUrl)),
    operations: { counters: operationsOf(day.http.counters), admin: operationsOf(day.http.admin) },
  });
  console.log(text);
  process.exitCode = results.some((result) => result.status === 'fail') ? 1 : 0;
} finally {
  await api.stop();
  if (!process.argv.includes('--keep-db')) {
    await db.drop();
  }
}
