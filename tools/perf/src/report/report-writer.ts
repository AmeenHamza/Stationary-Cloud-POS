import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BudgetResult } from './budget-check.js';
import type { PerfMetrics } from './metrics.js';
import type { DatasetSummary } from '../dataset/generate-dataset.js';
import type { HttpMeter } from '../measure/http-client.js';
import type { RedisStats } from '../measure/redis-stats.js';
import type { DayResult } from '../scenarios/day-simulation.js';

export interface PerfReport {
  generatedAt: string;
  dataset: DatasetSummary;
  metrics: PerfMetrics;
  budgets: BudgetResult[];
  db: DayResult['db'];
  ws: DayResult['ws'];
  redis: RedisStats;
  operations: Record<
    'counters' | 'admin',
    Record<string, { count: number; avgBytes: number; avgDbBytes: number }>
  >;
}

const kb = (bytes: number): string => `${(bytes / 1_024).toFixed(1)} KB`;
const mb = (bytes: number): string => `${(bytes / 1_048_576).toFixed(1)} MB`;

export function operationsOf(meter: HttpMeter): PerfReport['operations']['counters'] {
  return Object.fromEntries(
    [...meter.byOperation.entries()].map(([name, stats]) => [
      name,
      {
        count: stats.count,
        avgBytes: Math.round(stats.received / stats.count),
        avgDbBytes: Math.round(stats.dbBytes / stats.count),
      },
    ]),
  );
}

function summary(report: PerfReport): string {
  const { metrics: m } = report;
  const budgetRows = report.budgets.map(
    (b) =>
      `| ${b.metric} | ${String(b.value)} | ${String(b.limit)} (${b.kind}) | ${b.status.toUpperCase()} |`,
  );
  const operationRows = (['counters', 'admin'] as const).flatMap((tab) =>
    Object.entries(report.operations[tab]).map(
      ([name, s]) =>
        `| ${tab} | ${name} | ${String(s.count)} | ${kb(s.avgBytes)} | ${kb(s.avgDbBytes)} |`,
    ),
  );
  return [
    `# Network workload report (${report.generatedAt})`,
    '',
    `Dataset: ${String(report.dataset.products)} products, ${String(report.dataset.customers)} customers, ${String(report.dataset.orders)} history bills (${String(report.dataset.orderLines)} lines).`,
    `Day: ${String(m.bills)} bills (${String(m.lines)} lines), ${String(m.refunds)} refund(s); database ${mb(m.dbBytesDay)} a day, **${mb(m.dbBytesMonth)} a month** at this pace.`,
    '',
    '| Metric | Value | Limit | Status |',
    '|---|---|---|---|',
    ...budgetRows,
    '',
    '| Tab | Operation | Requests | Avg response | Avg DB bytes |',
    '|---|---|---|---|---|',
    ...operationRows,
    '',
  ].join('\n');
}

/** `perf-report/report.json` and `summary.md` (git-ignored; CI uploads them as artifacts). */
export async function writeReport(directory: string, report: PerfReport): Promise<string> {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  const text = summary(report);
  await writeFile(path.join(directory, 'summary.md'), text);
  return text;
}
