import { describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { apply } from '../src/commands/apply.js';
import { verify } from '../src/commands/verify.js';

import { PLANNED, targetCounts, useFixture } from './support.js';

const t = useFixture();

const one = async <T extends Record<string, unknown>>(sql: string): Promise<T | undefined> =>
  (await querySql<T>(t.f.target.url, sql))[0];

describe('apply (MIG-02, MIG-03, MIG-04, MIG-05)', () => {
  it('MIG-03: migrates everything and validates before committing', async () => {
    const report = await apply(t.f.config, t.f.log, t.fingerprint);

    expect(report.outcome).toMatch(/^MIGRATED/);
    expect(report.ok).toBe(true);
    expect(report.checks.filter((check) => !check.passed)).toEqual([]);
    expect(report.checks.length).toBeGreaterThan(30);
    expect(await targetCounts(t.f.target.url)).toEqual(PLANNED);
    expect(report.steps.find((s) => s.step === 'orders')).toEqual({
      step: 'orders',
      planned: 6,
      inserted: 6,
    });
  });

  it('keeps money, balances, dates and links exactly', async () => {
    const totals = await one<{ sales: string; refunded: string }>(
      'SELECT sum(total)::text AS sales, sum(refunded_total)::text AS refunded FROM orders',
    );
    expect(totals).toEqual({ sales: '686.60', refunded: '215.00' });
    const balances = await querySql<{ legacy_id: string; balance: string }>(
      t.f.target.url,
      `SELECT legacy_id, balance::text AS balance FROM customers UNION ALL
       SELECT 'v' || legacy_id, balance::text FROM vendors ORDER BY 1`,
    );
    expect(balances).toEqual([
      { legacy_id: '1', balance: '290.00' },
      { legacy_id: '2', balance: '0.00' },
      { legacy_id: 'v1', balance: '600.00' },
      { legacy_id: 'v2', balance: '300.00' },
    ]);
    expect(
      await one(`SELECT tax_rate::text, line_tax::text, line_net::text FROM order_lines l
                 JOIN orders o ON o.id = l.order_id WHERE o.legacy_id = '3' AND l.line_no = 1`),
    ).toEqual({ tax_rate: '13.00', line_tax: '15.60', line_net: '120.00' });
    expect(
      await one(`SELECT r.business_date::text AS day, r.settlement::text, e.type::text
                 FROM refunds r JOIN orders o ON o.id = r.order_id
                 JOIN customer_ledger_entries e ON e.refund_id = r.id WHERE o.legacy_id = '6'`),
    ).toEqual({ day: '2026-11-04', settlement: 'KHATA_CREDIT', type: 'REFUND_CREDIT' });
    expect(
      await one(`SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS at
                 FROM categories WHERE legacy_id = '1'`),
    ).toEqual({ at: '2026-07-07 05:00:00.123' });
    expect(
      await one(`SELECT low_stock_threshold_pieces AS pieces, low_stock_threshold_unit::text AS unit
                 FROM products WHERE legacy_id = '2'`),
    ).toEqual({ pieces: 24, unit: 'BOX' });
    expect(
      await one(`SELECT count(*)::int AS n FROM products p JOIN categories c ON c.id = p.category_id
                 WHERE c.legacy_id = '1'`),
    ).toEqual({ n: 3 });
  });

  it('MIG-04: the first product keeps a duplicated barcode; the next keeps it as legacy_barcode', async () => {
    const rows = await querySql<{
      legacy_id: string;
      barcode: string | null;
      legacy_barcode: string | null;
    }>(
      t.f.target.url,
      `SELECT legacy_id, barcode, legacy_barcode FROM products
       WHERE legacy_id IN ('2', '3', '4') ORDER BY legacy_id`,
    );
    expect(rows).toEqual([
      { legacy_id: '2', barcode: '222', legacy_barcode: null },
      { legacy_id: '3', barcode: null, legacy_barcode: '222' },
      { legacy_id: '4', barcode: null, legacy_barcode: 'X'.repeat(70) },
    ]);
  });

  it('MIG-05: bill counters continue after the highest migrated number of each date', async () => {
    const counters = await querySql(
      t.f.target.url,
      `SELECT business_date::text AS day, last_value FROM bill_number_counters ORDER BY 1`,
    );
    expect(counters).toEqual([
      { day: '2026-10-30', last_value: 2 },
      { day: '2026-10-31', last_value: 3 },
      { day: '2026-11-01', last_value: 1 },
    ]);
  });

  it('MIG-02: a second run inserts nothing and validates again', async () => {
    const report = await apply(t.f.config, t.f.log, t.fingerprint);

    expect(report.ok).toBe(true);
    expect(
      report.steps
        .filter((step) => step.step !== 'bill_number_counters')
        .every((s) => s.inserted === 0),
    ).toBe(true);
    expect(await targetCounts(t.f.target.url)).toEqual(PLANNED);
  });

  it('verify finds a value that differs from the old data, and passes once it is put back', async () => {
    expect((await verify(t.f.config, t.f.log)).ok).toBe(true);
    await querySql(
      t.f.target.url,
      "UPDATE orders SET created_at = created_at + interval '1 second' WHERE legacy_id = '1'",
    );
    const report = await verify(t.f.config, t.f.log);
    await querySql(
      t.f.target.url,
      "UPDATE orders SET created_at = created_at - interval '1 second' WHERE legacy_id = '1'",
    );

    expect(report.ok).toBe(false);
    const failed = report.checks.filter((check) => !check.passed);
    expect(failed.map((check) => check.name)).toEqual(['records: orders']);
    expect(failed[0]?.samples[0]).toMatch(
      /^#1: createdAt old 2026-10-30T05:00:00\.555Z, new 2026-10-30T05:00:01\.555Z$/,
    );
    expect((await verify(t.f.config, t.f.log)).ok).toBe(true);
  });
});
