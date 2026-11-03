import type { PerfMetrics } from './metrics.js';

export interface BudgetFile {
  tolerance: number;
  budgets: Readonly<Record<string, number>>;
  ceilings: Readonly<Record<string, number>>;
}

export interface BudgetResult {
  metric: string;
  value: number;
  limit: number;
  kind: 'budget' | 'ceiling';
  status: 'pass' | 'over' | 'fail';
}

/**
 * NETWORK_OPTIMIZATION.md §8.3: a budget passes at or under its value, is `over` within the
 * tolerance (reported, not failed) and fails beyond it; a ceiling fails as soon as it is exceeded.
 */
export function checkBudgets(metrics: PerfMetrics, file: BudgetFile): BudgetResult[] {
  const valueOf = (metric: string): number => {
    const value = (metrics as unknown as Record<string, unknown>)[metric];
    if (typeof value !== 'number') {
      throw new Error(`budgets.json names an unknown metric: ${metric}`);
    }
    return value;
  };
  const budgets = Object.entries(file.budgets).map(([metric, limit]): BudgetResult => {
    const value = valueOf(metric);
    const status =
      value <= limit ? 'pass' : value <= limit * (1 + file.tolerance) ? 'over' : 'fail';
    return { metric, value, limit, kind: 'budget', status };
  });
  const ceilings = Object.entries(file.ceilings).map(([metric, limit]): BudgetResult => {
    const value = valueOf(metric);
    return { metric, value, limit, kind: 'ceiling', status: value <= limit ? 'pass' : 'fail' };
  });
  return [...budgets, ...ceilings];
}
