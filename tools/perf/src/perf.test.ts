import { describe, expect, it } from 'vitest';

import { linesForBill, seededRandom } from './random.js';
import { checkBudgets, type BudgetFile } from './report/budget-check.js';

import type { PerfMetrics } from './report/metrics.js';

describe('seeded workload choices (NETWORK_OPTIMIZATION.md §8.3 reproducibility)', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = seededRandom(7);
    const second = seededRandom(7);
    const values = Array.from({ length: 5 }, () => first.next());
    expect(Array.from({ length: 5 }, () => second.next())).toEqual(values);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('draws 1–6 lines per bill around the configured mean', () => {
    const random = seededRandom(3);
    const counts = Array.from({ length: 5_000 }, () => linesForBill(random, 3.2));
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(6);
    const mean = counts.reduce((total, count) => total + count, 0) / counts.length;
    expect(mean).toBeGreaterThan(3.1);
    expect(mean).toBeLessThan(3.3);
  });
});

describe('budget check (§8.3)', () => {
  const file: BudgetFile = {
    tolerance: 0.1,
    budgets: { dbBytesScanBill3Lines: 100, dbBytesIdleHour: 100, dbBytesPerBillAmortized: 100 },
    ceilings: { dbBytesMonth: 1_000 },
  };
  const metrics = {
    dbBytesScanBill3Lines: 100,
    dbBytesIdleHour: 109,
    dbBytesPerBillAmortized: 111,
    dbBytesMonth: 1_001,
  } as unknown as PerfMetrics;

  it('passes at the budget, reports within the tolerance, fails beyond it and above any ceiling', () => {
    expect(checkBudgets(metrics, file).map((result) => [result.metric, result.status])).toEqual([
      ['dbBytesScanBill3Lines', 'pass'],
      ['dbBytesIdleHour', 'over'],
      ['dbBytesPerBillAmortized', 'fail'],
      ['dbBytesMonth', 'fail'],
    ]);
  });

  it('refuses a budget for a metric the report does not produce', () => {
    expect(() => checkBudgets(metrics, { ...file, budgets: { nope: 1 } })).toThrow(
      'unknown metric',
    );
  });
});
