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

  it('keeps the status in step with the refunded total', async () => {
    await rejects(order({ status: "'REFUNDED'", refunded_total: '100' }));
    await rejects(order({ status: "'COMPLETED'", refunded_total: '10' }));
    await rejects(order({ refunded_total: '300', status: "'PARTIALLY_REFUNDED'" }));
  });
});
