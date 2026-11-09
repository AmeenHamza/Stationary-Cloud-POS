import { runIntegrityChecks } from '@pos/database';

import type { CheckResult } from './compare.js';
import type pg from 'pg';

/**
 * The application's own integrity checks (DATABASE.md §12) on the new database: stock ledger, both
 * khatas, bill arithmetic, refund totals and bill numbers. Each must find no offending row.
 */
export async function integrityChecks(client: pg.ClientBase): Promise<CheckResult[]> {
  const results = await runIntegrityChecks(async (sql) => {
    const response = await client.query<{ count: number; ids: string[] }>(sql.text, sql.values);
    return response.rows;
  });
  return results.map((result) => ({
    name: `integrity: ${result.name}`,
    passed: result.count === 0,
    critical: true,
    detail: `${String(result.count)} offending row(s)`,
    samples: result.ids.slice(0, 20),
  }));
}
