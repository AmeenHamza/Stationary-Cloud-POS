import type { LegacyEntity } from '../legacy/schema-map.js';
import type { Preflight } from '../target/preflight.js';
import type { StepResult } from '../target/step.js';
import type { Issue } from '../transform/issues.js';
import type { MigrationPlan } from '../transform/plan.js';
import type { CheckResult } from '../verify/compare.js';

export type Mode = 'check' | 'dry-run' | 'apply' | 'verify';

/** Everything a run found and did: written to `report.md` and summarised on the console. */
export interface RunReport {
  mode: Mode;
  startedAt: Date;
  /** Host and database only (never credentials). */
  legacy: string;
  target: string;
  fingerprint: string | null;
  schemaProblems: string[];
  read: Record<LegacyEntity, number> | null;
  planned: Record<string, number> | null;
  preflight: Preflight | null;
  steps: StepResult[];
  checks: CheckResult[];
  issues: readonly Issue[];
  oldGstRate: string | null;
  /** One line: what happened and what to do next. */
  outcome: string;
  ok: boolean;
}

export function emptyReport(mode: Mode, legacy: string, target: string): RunReport {
  return {
    mode,
    startedAt: new Date(),
    legacy,
    target,
    fingerprint: null,
    schemaProblems: [],
    read: null,
    planned: null,
    preflight: null,
    steps: [],
    checks: [],
    issues: [],
    oldGstRate: null,
    outcome: '',
    ok: false,
  };
}

/** Rows the plan would write, per new table (the dry run's estimate of the work). */
export function plannedCounts(plan: MigrationPlan): Record<string, number> {
  const refunds = plan.orders.flatMap((order) => (order.refund === null ? [] : [order.refund]));
  return {
    categories: plan.categories.length,
    products: plan.products.length,
    stock_movements: plan.products.filter((product) => product.stockPieces !== 0).length,
    customers: plan.customers.length,
    vendors: plan.vendors.length,
    orders: plan.orders.length,
    order_lines: plan.orders.reduce((lines, order) => lines + order.lines.length, 0),
    refunds: refunds.length,
    refund_lines: refunds.reduce((lines, refund) => lines + refund.lines.length, 0),
    customer_ledger_entries: plan.customerEntries.length,
    vendor_ledger_entries: plan.vendorEntries.length,
    bill_number_counters: plan.counters.length,
  };
}

/** Failed checks that stop a run (critical) and those that are only reported. */
export function failedChecks(checks: readonly CheckResult[]): {
  critical: CheckResult[];
  advisory: CheckResult[];
} {
  const failed = checks.filter((check) => !check.passed);
  return {
    critical: failed.filter((check) => check.critical),
    advisory: failed.filter((check) => !check.critical),
  };
}
