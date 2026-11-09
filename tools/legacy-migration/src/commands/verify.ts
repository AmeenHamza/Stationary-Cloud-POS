import { closeSnapshot, openLegacySnapshot, openTarget } from '../db/connect.js';
import { checkLegacySchema } from '../legacy/schema-check.js';
import { failedChecks, type RunReport } from '../report/run-report.js';
import { validate } from '../verify/validate.js';

import { finishRun, readOldSide, startRun } from './old-side.js';

import type { MigrationConfig } from '../config.js';
import type { RunLog } from '../log.js';
import type pg from 'pg';

/**
 * Post-migration validation at any time, reading both databases only. While the old app is still in
 * use its newer data shows up as differences; after cutover there must be none.
 */
export async function verify(config: MigrationConfig, log: RunLog): Promise<RunReport> {
  const run = startRun(config, 'verify', log);
  const { report } = run;
  const old = await readOldSide(config, log, report);
  if (old === null) {
    return finishRun(run, null, log);
  }
  let target: pg.Client | null = null;
  try {
    target = await openTarget(config.targetUrl, log, true);
    report.checks = await validate(target, old, config.timeZone);
  } finally {
    await target?.end();
    await closeSnapshot(old.client);
  }
  const { critical, advisory } = failedChecks(report.checks);
  report.ok = critical.length === 0;
  report.outcome = report.ok
    ? `VALID: the new database matches the old one (${String(advisory.length)} warning(s)).`
    : `NOT VALID: ${String(critical.length)} check(s) failed (see the validation section).`;
  report.fingerprint = null;
  return finishRun(run, null, log);
}

/** Compares `schema-map.ts` with the old database (names and types only) and reads no data. */
export async function check(config: MigrationConfig, log: RunLog): Promise<RunReport> {
  const run = startRun(config, 'check', log);
  const client = await openLegacySnapshot(config.legacyUrl, log);
  try {
    run.report.schemaProblems = (await checkLegacySchema(client)).problems;
  } finally {
    await closeSnapshot(client);
  }
  run.report.ok = run.report.schemaProblems.length === 0;
  run.report.outcome = run.report.ok
    ? 'The old schema matches schema-map.ts.'
    : 'The old schema differs from schema-map.ts (see the report).';
  return finishRun(run, null, log);
}
