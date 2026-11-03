import { beforeAll, describe, expect, it } from 'vitest';

import { HISTORY, LIVE, seedDashboardDay } from './support/dashboard';
import { dataOf, errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

let today = '';
let ids = { pens: '', ink: '', s2: '' };

beforeAll(async () => {
  ({ today, ids } = await seedDashboardDay(t));
});

describe('dashboard live figures (F-06, API.md §6.3, Q18, Q28, Q30, Q31)', () => {
  it('matches the hand-computed tiles and summaries in ≤ 5 statements and ≤ 3 KB', async () => {
    await asUser(t.h.url, t.admin, LIVE, {}); // warm-up: session cached
    t.h.statements.reset();
    const response = await asUser<{ dashboard: Record<string, unknown> }>(
      t.h.url,
      t.admin,
      LIVE,
      {},
    );
    expect(t.h.statements.count).toBeLessThanOrEqual(5); // day, inventory, khata totals once, methods × 3
    expect(Buffer.byteLength(JSON.stringify(response.body))).toBeLessThanOrEqual(3 * 1_024);
    expect(dataOf(response).dashboard).toEqual({
      date: today,
      today: {
        netSales: '259.90',
        billCount: 3,
        discountTotal: '10.00',
        taxTotal: '14.90',
        refundTotal: '95.00',
      },
      // pens 98 × 100 + ink 99 × 50; negative glue stock and the archived product are excluded
      inventory: { sellingValue: '14750.00', costValue: '8850.00', productCount: 3 },
      customerDues: '100.00', // the advance customer's −50 is not netted
      customerCount: 2,
      vendorOwes: '0.00',
      vendorCount: 0,
      paymentMethodsToday: [
        { method: 'UDHAAR', total: '100.00', billCount: 1 },
        { method: 'CASH', total: '95.00', billCount: 1 },
        { method: 'CARD', total: '64.90', billCount: 1 },
      ],
      paymentMethodsThisWeek: [
        { method: 'UDHAAR', total: '100.00', billCount: 1 },
        { method: 'CASH', total: '95.00', billCount: 1 },
        { method: 'CARD', total: '64.90', billCount: 1 },
      ],
      paymentMethodsThisMonth: [
        { method: 'UDHAAR', total: '100.00', billCount: 1 },
        { method: 'CASH', total: '95.00', billCount: 1 },
        { method: 'CARD', total: '64.90', billCount: 1 },
      ],
    });
  });

  it('reports another day on request, admins only, within its bounds', async () => {
    const past = dataOf(
      await asUser<{ dashboard: { today: { netSales: string; billCount: number } } }>(
        t.h.url,
        t.admin,
        'query { dashboard(date: "2026-01-01") { today { netSales billCount } } }',
      ),
    );
    expect(past.dashboard.today).toEqual({ netSales: '0.00', billCount: 0 });
    expect(errorCode(await asUser(t.h.url, t.cashier, LIVE, {}))).toBe('FORBIDDEN');
    for (const field of [
      'dailySales(days: 32) { total }',
      'productRanking(direction: HIGHEST, limit: 11) { units }',
      'monthlySales(year: 1999) { total }',
    ]) {
      expect(errorCode(await asUser(t.h.url, t.admin, `{ dashboard { ${field} } }`)), field).toBe(
        'BAD_USER_INPUT',
      );
    }
  });
});

describe('dashboard history (F-07)', () => {
  it('ranks products, fills every day and compares months with last year', async () => {
    const year = Number.parseInt(today.slice(0, 4), 10);
    const month = Number.parseInt(today.slice(5, 7), 10);
    const read = async () => {
      const response = await asUser<{
        dashboard: Record<string, { month?: number; date?: string }[]>;
      }>(t.h.url, t.admin, HISTORY, { year, productId: ids.ink });
      expect(Buffer.byteLength(JSON.stringify(response.body))).toBeLessThanOrEqual(8 * 1_024);
      return dataOf(response).dashboard;
    };
    const before = await read();
    expect(before['top']).toEqual([
      { name: 'Dash Pens', units: 2, total: '195.00' }, // 3 sold − 1 returned; 190 + 100 − 95
      { name: 'Dash Ink', units: 1, total: '55.00' },
    ]);
    expect(before['bottom']?.map((row) => row)).toEqual([
      { name: 'Dash Ink', units: 1 },
      { name: 'Dash Pens', units: 2 },
    ]);
    expect(before['dailySales']).toHaveLength(31);
    expect(before['dailySales']?.at(-1)).toEqual({ date: today, total: '259.90' });
    expect(before['productDays']).toHaveLength(31);
    expect(before['productDays']?.at(-1)).toEqual({ date: today, total: '55.00' });
    expect(before['monthlySales']?.find((row) => row.month === month)).toEqual({
      month,
      total: '259.90',
      sameMonthLastYear: '0.00',
    });

    await t.prisma
      .$executeRaw`UPDATE orders SET business_date = business_date - interval '1 year' WHERE id = ${ids.s2}::uuid`;
    const after = await read();
    expect(after['monthlySales']).toHaveLength(12);
    expect(after['monthlySales']?.find((row) => row.month === month)).toEqual({
      month,
      total: '195.00',
      sameMonthLastYear: '64.90',
    });
  });
});
