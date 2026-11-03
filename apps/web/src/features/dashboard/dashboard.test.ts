import { getOperationAST } from 'graphql';
import { describe, expect, it } from 'vitest';

import { axisLabel, niceMax, toAmount } from '@/components/charts/chart-scale';
import { LIVE_QUERIES } from '@/lib/realtime/live-queries';

import { dayLabel, monthLabel } from './dashboard-labels';
import { DashboardLiveDocument } from './graphql/dashboard.documents';

describe('dashboard (F-06, F-07)', () => {
  it('refreshes the real live query on sales, refunds, stock and khata events', () => {
    expect([getOperationAST(DashboardLiveDocument)?.name?.value]).toEqual(LIVE_QUERIES.dashboard);
  });

  it('labels months and business days without the PC time zone', () => {
    expect([monthLabel(1), monthLabel(12)]).toEqual(['Jan', 'Dec']);
    expect(dayLabel('2026-10-31')).toBe('Sat 31');
  });

  it('scales columns to a clean axis top and labels ticks in full below 10,000', () => {
    expect(niceMax([259.9])).toBe(500);
    expect(niceMax([1_900])).toBe(2_000);
    expect(niceMax([0])).toBe(1);
    expect(niceMax([24_000])).toBe(25_000);
    expect([axisLabel(2_500), axisLabel(25_000)]).toEqual(['2,500', '25K']);
    expect(toAmount('1234.50')).toBe(1234.5);
  });
});
