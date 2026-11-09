import { closeSnapshot, openTarget } from '../db/connect.js';
import { failedChecks, type RunReport } from '../report/run-report.js';
import { preflight } from '../target/preflight.js';
import { rowsReadCheck } from '../verify/compare.js';

import { finishRun, readOldSide, startRun } from './old-side.js';

import type { MigrationConfig } from '../config.js';
import type { RunLog } from '../log.js';

/**
 * Reads the old database, plans the migration and checks the new database, without writing anything
 * anywhere (MAPPING.md §11). The report lists the planned rows, every finding and the fingerprint
 * that `apply --confirm` needs.
 */
export async function dryRun(config: MigrationConfig, log: RunLog): Promise<RunReport> {
  const run = startRun(config, 'dry-run', log);
  const { report } = run;
  const old = await readOldSide(config, log, report);
  if (old === null) {
    return finishRun(run, null, log);
  }
  try {
    report.checks = [rowsReadCheck(old.plan.read, old.counted)];
  } finally {
    await closeSnapshot(old.client);
  }
  const target = await openTarget(config.targetUrl, log, true);
  try {
    report.preflight = await preflight(target);
  } finally {
    await target.end();
  }
  const blocking = old.plan.issues.blocking;
  const notReady = report.preflight.problems.length > 0;
  const unread = failedChecks(report.checks).critical.length > 0;
  report.ok = blocking === 0 && !notReady && !unread;
  if (blocking > 0) {
    report.outcome = `${String(blocking)} blocking finding(s): fix them in the old app, then run the dry run again.`;
  } else if (unread) {
    report.outcome = 'Not every old row was read: see the validation section.';
  } else if (notReady) {
    report.outcome =
      'The plan is fine, but the new database is not ready: see "New database check".';
  } else {
    report.outcome =
      `Ready. Nothing was written. To migrate exactly this data: ` +
      `pnpm --filter @pos/legacy-migration migrate apply --confirm ${old.fingerprint}`;
  }
  return finishRun(run, old.plan, log);
}
