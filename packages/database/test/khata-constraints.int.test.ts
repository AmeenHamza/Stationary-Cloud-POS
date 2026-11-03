import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, querySql, requireTestEnv, type TestDatabase } from '@pos/testkit';

import { runPrisma } from './prisma-cli.js';

let db: TestDatabase;
const CUSTOMER_ID = '0192f0c1-0000-7000-8000-0000000000c1';
const VENDOR_ID = '0192f0c1-0000-7000-8000-0000000000d1';
const ORDER_ID = '0192f0c1-0000-7000-8000-0000000000e1';

beforeAll(async () => {
  db = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), { prefix: 'kha' });
  const result = runPrisma(['migrate', 'deploy'], db.url);
  if (result.status !== 0) {
    throw new Error(result.output);
  }
  await querySql(
    db.url,
    `INSERT INTO customers (id, name, name_key, updated_at) VALUES ($1, 'Ali', 'ali', now())`,
    [CUSTOMER_ID],
  );
  await querySql(
    db.url,
    `INSERT INTO vendors (id, name, name_key, updated_at) VALUES ($1, 'Supplier', 'supplier', now())`,
    [VENDOR_ID],
  );
  // A credit-sale entry must reference a real bill (foreign key to orders).
  await querySql(
    db.url,
    `INSERT INTO orders (id, bill_number, business_date, idempotency_key, cashier_name, customer_id,
       payment_method, discount_type, discount_value, subtotal, discount_total, product_tax_total, total)
     VALUES ($1, 'ORD-20261028-001', '2026-10-28', gen_random_uuid(), 'Till', $2,
       'UDHAAR', 'NONE', 0, 99, 0, 0, 99)`,
    [ORDER_ID, CUSTOMER_ID],
  );
});

afterAll(async () => {
  await db.drop();
});

const rejects = (sql: string): Promise<unknown> =>
  expect(querySql(db.url, sql)).rejects.toThrow(/violates check constraint|duplicate key/);

const customerEntry = (
  type: string,
  amount: number,
  extra: Record<string, string> = {},
): string => {
  const columns = ['customer_id', 'type', 'amount', 'balance_after', ...Object.keys(extra)];
  const values = [`'${CUSTOMER_ID}'`, `'${type}'`, String(amount), '0', ...Object.values(extra)];
  return `INSERT INTO customer_ledger_entries (${columns.join(', ')}) VALUES (${values.join(', ')})`;
};

const vendorEntry = (type: string, amount: number, method?: string): string =>
  `INSERT INTO vendor_ledger_entries (vendor_id, type, amount, balance_after${method === undefined ? '' : ', payment_method'})
   VALUES ('${VENDOR_ID}', '${type}', ${String(amount)}, 0${method === undefined ? '' : `, '${method}'`})`;

describe('khata constraints (DATABASE.md §4.7–4.8)', () => {
  it('enforces the customer entry sign, payment method and references per type', async () => {
    await rejects(customerEntry('MANUAL_CREDIT', -10));
    await rejects(customerEntry('PAYMENT', 10, { payment_method: "'CASH'" }));
    await rejects(customerEntry('PAYMENT', -10)); // a payment needs a method
    await rejects(customerEntry('PAYMENT', -10, { payment_method: "'UDHAAR'" }));
    await rejects(customerEntry('MANUAL_CREDIT', 10, { payment_method: "'CASH'" }));
    await rejects(customerEntry('CREDIT_SALE', 10)); // needs the order
    await rejects(customerEntry('REFUND_CREDIT', -10)); // needs the refund
    await rejects(customerEntry('OPENING_BALANCE', 0));
    await rejects(customerEntry('MANUAL_CREDIT', 10, { idempotency_key: 'gen_random_uuid()' }));
    await querySql(db.url, customerEntry('MANUAL_CREDIT', 10));
    await querySql(db.url, customerEntry('PAYMENT', -10, { payment_method: "'EASYPAISA'" }));
    await querySql(db.url, customerEntry('OPENING_BALANCE', -5)); // an advance (Q25)
  });

  it('posts at most one credit-sale entry per order', async () => {
    await querySql(db.url, customerEntry('CREDIT_SALE', 99, { order_id: `'${ORDER_ID}'` }));
    await rejects(customerEntry('CREDIT_SALE', 99, { order_id: `'${ORDER_ID}'` }));
  });

  it('enforces the vendor entry sign and payment method (D-20)', async () => {
    await rejects(vendorEntry('PURCHASE', -100));
    await rejects(vendorEntry('PAYMENT', -100));
    await rejects(vendorEntry('PAYMENT', 100, 'CASH'));
    await rejects(vendorEntry('PURCHASE', 100, 'CASH'));
    await querySql(db.url, vendorEntry('PURCHASE', 100));
    await querySql(db.url, vendorEntry('PAYMENT', -40, 'BANK_TRANSFER'));
  });

  it('dates entries by the business day in Asia/Karachi (from the database clock)', async () => {
    const [row] = await querySql<{ matches: boolean }>(
      db.url,
      `SELECT business_date = (now() AT TIME ZONE 'Asia/Karachi')::date AS matches
       FROM vendor_ledger_entries ORDER BY id DESC LIMIT 1`,
    );
    expect(row?.matches).toBe(true);
  });
});
