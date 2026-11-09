import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { markdown } from './markdown.js';
import { failedChecks, type RunReport } from './run-report.js';

import type { RunLog } from '../log.js';
import type { MigrationPlan } from '../transform/plan.js';

type Cell = string | number | boolean;

const cell = (value: Cell): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (rows: readonly (readonly Cell[])[]): string =>
  rows.map((row) => row.map(cell).join(',')).join('\n') + '\n';

/** Old id → new id for every record with a UUID (ledger entries keep the old id in `legacy_id`). */
function idMap(plan: MigrationPlan): string[][] {
  return [
    ['entity', 'old_id', 'new_id'],
    ...plan.categories.map((c) => ['category', c.legacyId, c.id]),
    ...plan.products.map((p) => ['product', p.legacyId, p.id]),
    ...plan.customers.map((c) => ['customer', c.legacyId, c.id]),
    ...plan.vendors.map((v) => ['vendor', v.legacyId, v.id]),
    ...plan.orders.map((o) => ['order', o.legacyId, o.id]),
    ...plan.orders.flatMap((o) =>
      o.refund === null ? [] : [['refund of order', o.legacyId, o.refund.id]],
    ),
  ];
}

/** Writes report.md, issues.csv and (when there is a plan) id-map.csv into the run folder. */
export function writeReport(dir: string, report: RunReport, plan: MigrationPlan | null): void {
  writeFileSync(path.join(dir, 'report.md'), markdown(report));
  const issues = report.issues.map((i) => [i.kind, i.blocking, i.ref, i.detail]);
  writeFileSync(
    path.join(dir, 'issues.csv'),
    csv([['kind', 'blocking', 'ref', 'detail'], ...issues]),
  );
  if (plan !== null) {
    writeFileSync(path.join(dir, 'id-map.csv'), csv(idMap(plan)));
  }
}

/** A short console summary; the details are in the run folder. */
export function printSummary(log: RunLog, report: RunReport, dir: string): void {
  const blocking = report.issues.filter((issue) => issue.blocking).length;
  const { critical, advisory } = failedChecks(report.checks);
  const passed = report.checks.length - critical.length - advisory.length;
  log.print('');
  log.print(`Mode: ${report.mode}   Old: ${report.legacy}   New: ${report.target}`);
  if (report.planned !== null) {
    const planned = Object.entries(report.planned).map(([t, n]) => `${t} ${String(n)}`);
    log.print(`Planned: ${planned.join(', ')}`);
  }
  log.print(`Findings: ${String(report.issues.length)} (${String(blocking)} blocking)`);
  if (report.checks.length > 0) {
    log.print(
      `Validation: ${String(passed)} passed, ${String(critical.length)} failed, ${String(advisory.length)} warnings`,
    );
  }
  for (const check of critical.slice(0, 10)) {
    log.print(`  FAIL ${check.name}: ${check.detail}`);
  }
  if (report.fingerprint !== null) {
    log.print(`Fingerprint: ${report.fingerprint}`);
  }
  log.print(`Outcome: ${report.outcome}`);
  log.print(`Report: ${path.join(dir, 'report.md')}`);
}
