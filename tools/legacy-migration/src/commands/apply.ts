import { closeSnapshot, openTarget, withRetry } from '../db/connect.js';
import { redact } from '../log.js';
import { failedChecks, type RunReport } from '../report/run-report.js';
import { PreflightError, writePlan } from '../target/write-plan.js';
import { validate } from '../verify/validate.js';

import { finishRun, readOldSide, startRun, type OldSide } from './old-side.js';

import type { MigrationConfig } from '../config.js';
import type { RunLog } from '../log.js';

/**
 * One attempt: BEGIN, write everything, validate inside the same transaction, then COMMIT only if
 * every critical check passed. Any failure rolls back, so the new database is either fully migrated
 * and validated, or unchanged. A re-run after success inserts nothing and validates again.
 */
async function attempt(config: MigrationConfig, log: RunLog, old: OldSide, report: RunReport) {
  const client = await openTarget(config.targetUrl, log, false);
  try {
    await client.query('BEGIN');
    const context = { client, batchSize: config.batchSize, runAt: new Date(), log };
    report.steps = await writePlan(context, old.plan);
    log.info('Validating before commit');
    report.checks = await validate(client, old, config.timeZone);
    const { critical } = failedChecks(report.checks);
    if (critical.length > 0) {
      await client.query('ROLLBACK');
      report.outcome = `ROLLED BACK: ${String(critical.length)} validation check(s) failed. Nothing was written.`;
      return;
    }
    await client.query('COMMIT');
    report.ok = true;
    report.outcome = 'MIGRATED and validated. `migrate verify` checks it again at any time.';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (!(error instanceof PreflightError)) {
      throw error;
    }
    report.preflight = { problems: [...error.problems], migrated: {} };
    report.outcome =
      'REFUSED: the new database is not ready (see "New database check"). Nothing was written.';
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Writes the migration into the new database (MAPPING.md §11). Needs the fingerprint of a dry run of
 * the same old data: the owner confirms exactly what they reviewed. The old database is only read.
 */
export async function apply(
  config: MigrationConfig,
  log: RunLog,
  confirm: string | undefined,
): Promise<RunReport> {
  const run = startRun(config, 'apply', log);
  const { report } = run;
  if (confirm === undefined || confirm.trim() === '') {
    report.outcome = 'REFUSED: apply needs --confirm <fingerprint>; run the dry run to get it.';
    return finishRun(run, null, log);
  }
  const old = await readOldSide(config, log, report);
  if (old === null) {
    return finishRun(run, null, log);
  }
  try {
    if (old.plan.issues.blocking > 0) {
      report.outcome = `REFUSED: ${String(old.plan.issues.blocking)} blocking finding(s). Nothing was written.`;
    } else if (old.fingerprint !== confirm.trim()) {
      report.fingerprint = null; // never hand out a fingerprint for data nobody reviewed
      report.outcome =
        'REFUSED: the old data is not what the confirmed dry run showed (it changed, or the ' +
        'fingerprint is wrong). Run the dry run again and review it. Nothing was written.';
    } else {
      await withRetry('The migration', log, () => attempt(config, log, old, report));
    }
  } catch (error) {
    report.outcome = `FAILED: ${redact(String(error))}. The transaction was rolled back; nothing was written.`;
  } finally {
    await closeSnapshot(old.client).catch(() => undefined);
  }
  return finishRun(run, old.plan, log);
}
