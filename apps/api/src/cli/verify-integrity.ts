import { existsSync } from 'node:fs';

import { createDatabaseClient, runIntegrityChecks } from '@pos/database';

/**
 * `pnpm --filter @pos/api cli:verify-integrity` (DATABASE.md §12): read-only checks of stock, khata,
 * bill and refund arithmetic, e.g. on a restored branch before switching to it. Exit code 1 when
 * any check finds offending rows; output is counts plus the first 50 ids per check.
 */
async function main(): Promise<void> {
  if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const url = process.env['DATABASE_URL'];
  if (url === undefined) {
    console.error('DATABASE_URL is not set.');
    process.exitCode = 2;
    return;
  }
  const client = createDatabaseClient({ connectionString: url, maxConnections: 1 });
  try {
    const results = await runIntegrityChecks((sql) => client.$queryRaw(sql));
    for (const result of results) {
      const ids = result.ids.length === 0 ? '' : ` e.g. ${result.ids.join(', ')}`;
      console.log(
        `${result.count === 0 ? 'PASS' : 'FAIL'} ${result.name}: ${String(result.count)}${ids}`,
      );
    }
    process.exitCode = results.every((result) => result.count === 0) ? 0 : 1;
  } finally {
    await client.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
