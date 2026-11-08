import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, querySql, requireTestEnv, type TestDatabase } from '@pos/testkit';

import { runPrisma } from './prisma-cli.js';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), { prefix: 'sal' });
  const result = runPrisma(['migrate', 'deploy'], db.url);
  if (result.status !== 0) {
    throw new Error(result.output);
  }
});

afterAll(async () => {
  await db.drop();
});

const rejects = (sql: string): Promise<unknown> =>
  expect(querySql(db.url, sql)).rejects.toThrow(/violates check constraint/);

/** An order insert with consistent defaults; override columns as `column = value` pairs. */
function order(overrides: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    id: 'gen_random_uuid()',
    bill_number: `'ORD-20261028-${String(Math.floor(Math.random() * 900) + 100)}'`,
    business_date: "'2026-10-28'",
    idempotency_key: 'gen_random_uuid()',
    cashier_name: "'Till'",
    payment_method: "'CASH'",
    discount_type: "'NONE'",
    discount_value: '0',
    subtotal: '240',
    discount_total: '0',
    product_tax_total: '0',
    bill_gst_rate: '18',
    bill_gst_amount: '43.20',
    total: '283.20',
    ...overrides,
  };
  return `INSERT INTO orders (${Object.keys(fields).join(', ')}) VALUES (${Object.values(fields).join(', ')})`;
}

describe('sales constraints (DATABASE.md §4.9–4.12)', () => {
  it('stores the screenshot bill and refuses a total that does not add up (FIN-19)', async () => {
    await querySql(db.url, order());
    await rejects(order({ total: '283.21' }));
  });

  it('refuses Udhaar without a customer, GST without a rate and inconsistent discounts', async () => {
    await rejects(order({ payment_method: "'UDHAAR'" }));
    await rejects(order({ bill_gst_rate: 'NULL' }));
    await rejects(order({ discount_type: "'NONE'", discount_value: '5' }));
    await rejects(order({ discount_type: "'PERCENT'", discount_value: '101' }));
  });

  it('lets item discounts stand alone, and nothing else without a discount type (D-27)', async () => {
    const onItems = {
      discount_total: '40',
      item_discount_total: '40',
      subtotal: '240',
      bill_gst_rate: 'NULL',
      bill_gst_amount: '0',
      total: '200',
    };
    await querySql(db.url, order(onItems));
    await rejects(order({ ...onItems, item_discount_total: '30' }));
    await rejects(
      order({
        ...onItems,
        discount_type: "'FLAT'",
        discount_value: '10',
        item_discount_total: '50',
      }),
    );
    await querySql(
      db.url,
      order({
        ...onItems,
        discount_type: "'FLAT'",
        discount_value: '10',
        item_discount_total: '30',
      }),
    );
  });

  it('keeps a line item discount within what the line was discounted', async () => {
    const id = crypto.randomUUID();
    await querySql(db.url, order({ id: `'${id}'` }));
    const line = (no: number, itemDiscount: string) =>
      `INSERT INTO order_lines (order_id, line_no, product_name, sale_unit, pieces_per_unit, quantity,
         unit_price, tax_rate, line_gross, item_discount, line_discount, line_net, line_tax)
       VALUES ('${id}', ${String(no)}, 'Pen', 'PIECE', 1, 1, 100, 0, 100, ${itemDiscount}, 20, 80, 0)`;
    await querySql(db.url, line(1, '20'));
    await rejects(line(2, '20.01'));
    await rejects(line(3, '-1'));
  });

  it('keeps the status in step with the refunded total', async () => {
    await rejects(order({ status: "'REFUNDED'", refunded_total: '100' }));
    await rejects(order({ status: "'COMPLETED'", refunded_total: '10' }));
    await rejects(order({ refunded_total: '300', status: "'PARTIALLY_REFUNDED'" }));
  });
});
