import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { describeUrl, type MigrationConfig } from '../config.js';
import { closeSnapshot, openLegacySnapshot } from '../db/connect.js';
import { countLegacyRows, readLegacy, type LegacyData } from '../legacy/reader.js';
import { checkLegacySchema } from '../legacy/schema-check.js';
import { emptyReport, plannedCounts, type Mode, type RunReport } from '../report/run-report.js';
import { printSummary, writeReport } from '../report/write-report.js';
import { fingerprintOf } from '../transform/fingerprint.js';
import { planMigration, type MigrationPlan } from '../transform/plan.js';

import type { LegacyEntity } from '../legacy/schema-map.js';
import type { RunLog } from '../log.js';
import type pg from 'pg';

/** The old database as of one snapshot, and what the migration would write from it. */
export interface OldSide {
  /** The open read-only snapshot; closed with `closeSnapshot` by the command. */
  client: pg.Client;
  data: LegacyData;
  counted: Record<LegacyEntity, number>;
  plan: MigrationPlan;
  fingerprint: string;
}

export interface Run {
  dir: string;
  report: RunReport;
}

/** Creates the run folder (`output/<time>-<mode>`) and starts the run log there. */
export function startRun(config: MigrationConfig, mode: Mode, log: RunLog): Run {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(config.outDir, `${stamp}-${mode}`);
  mkdirSync(dir, { recursive: true });
  log.attach(path.join(dir, 'run.jsonl'));
  log.info(`Started ${mode}`, {
    legacy: describeUrl(config.legacyUrl),
    target: describeUrl(config.targetUrl),
  });
  return {
    dir,
    report: emptyReport(mode, describeUrl(config.legacyUrl), describeUrl(config.targetUrl)),
  };
}

/** Writes the run's report files and prints the summary. */
export function finishRun(run: Run, plan: MigrationPlan | null, log: RunLog): RunReport {
  writeReport(run.dir, run.report, plan);
  log.info('Finished', { ok: run.report.ok, outcome: run.report.outcome });
  printSummary(log, run.report, run.dir);
  return run.report;
}

/**
 * Opens the old database's snapshot, checks its schema against `schema-map.ts`, reads every mapped
 * table and plans the migration. Returns null (with the reason in the report) when the schema differs.
 */
export async function readOldSide(
  config: MigrationConfig,
  log: RunLog,
  report: RunReport,
): Promise<OldSide | null> {
  const client = await openLegacySnapshot(config.legacyUrl, log);
  try {
    const check = await checkLegacySchema(client);
    report.schemaProblems = check.problems;
    if (check.problems.length > 0) {
      report.outcome = 'STOPPED: the old schema differs from schema-map.ts (see the report).';
      await closeSnapshot(client);
      return null;
    }
    log.info('Reading the old database', { batchSize: config.batchSize });
    const data = await readLegacy(client, {
      check,
      naiveZone: config.naiveZone,
      batchSize: config.batchSize,
    });
    const counted = await countLegacyRows(client);
    const plan = planMigration(data, config.timeZone);
    const fingerprint = fingerprintOf(plan);
    report.read = plan.read;
    report.planned = plannedCounts(plan);
    report.issues = plan.issues.list;
    report.fingerprint = fingerprint;
    report.oldGstRate = plan.shopGstRate?.toFixed(2) ?? null;
    log.info('Planned', {
      ...report.planned,
      findings: plan.issues.list.length,
      blocking: plan.issues.blocking,
    });
    return { client, data, counted, plan, fingerprint };
  } catch (error) {
    await closeSnapshot(client).catch(() => undefined);
    throw error;
  }
}
