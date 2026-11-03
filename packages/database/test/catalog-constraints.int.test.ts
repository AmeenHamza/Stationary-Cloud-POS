import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, querySql, requireTestEnv, type TestDatabase } from '@pos/testkit';

import { runPrisma } from './prisma-cli.js';

let db: TestDatabase;
const PRODUCT_ID = '0192f0c1-0000-7000-8000-0000000000aa';

beforeAll(async () => {
  db = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), { prefix: 'cat' });
  const result = runPrisma(['migrate', 'deploy'], db.url);
  if (result.status !== 0) {
    throw new Error(result.output);
  }
  await querySql(
    db.url,
    `INSERT INTO products (id, name, name_key, sale_price, barcode, updated_at)
     VALUES ($1, 'Pencil', 'pencil', 10, 'B-1', now())`,
    [PRODUCT_ID],
  );
});

afterAll(async () => {
  await db.drop();
});

const rejects = (sql: string, params: unknown[] = []): Promise<unknown> =>
  expect(querySql(db.url, sql, params)).rejects.toThrow(/violates check constraint|duplicate key/);

const product = (fields: string, values: string): string =>
  `INSERT INTO products (id, name, name_key, sale_price, updated_at, ${fields})
   VALUES (gen_random_uuid(), 'X', 'x', 1, now(), ${values})`;

const movement = (type: string, quantity: number, extra = ''): string =>
  `INSERT INTO stock_movements (product_id, type, quantity_pieces, balance_after${extra === '' ? '' : ', reason'})
   VALUES ('${PRODUCT_ID}', '${type}', ${String(quantity)}, 0${extra === '' ? '' : `, '${extra}'`})`;

describe('catalog constraints (DATABASE.md §4.4–4.6)', () => {
  it('rejects negative prices, out-of-range tax and box settings, and orphan idempotency keys', async () => {
    await rejects(product('cost_price', '-1'));
    await rejects(product('tax_rate', '100.01'));
    await rejects(product('pieces_per_box', '0'));
    await rejects(product('box_price', '50')); // box price with pieces_per_box = 1 (D-17)
    await rejects(product('low_stock_threshold_pieces', '-1'));
    await rejects(product('idempotency_key', 'gen_random_uuid()')); // key without request hash
  });

  it('allows negative stock (D-16) and a reused barcode only once the first is archived', async () => {
    await querySql(db.url, product('stock_pieces', '-5'));
    await rejects(product('barcode', "'B-1'"));
    await querySql(db.url, 'UPDATE products SET archived_at = now() WHERE id = $1', [PRODUCT_ID]);
    await querySql(db.url, product('barcode', "'B-1'"));
  });

  it('enforces the movement sign and reason per type (FIN-23)', async () => {
    await rejects(movement('RESTOCK', -1));
    await rejects(movement('ADJUSTMENT_DECREASE', 3, 'DAMAGED'));
    await rejects(movement('ADJUSTMENT_DECREASE', -3)); // reason required
    await rejects(movement('RESTOCK', 2, 'OTHER')); // reason only on adjustments
    await rejects(movement('SALE', -1)); // a sale needs its order
    await querySql(db.url, movement('ADJUSTMENT_DECREASE', -3, 'DAMAGED'));
    await querySql(db.url, movement('RESTOCK', 4));
  });

  it('keeps category names unique case-insensitively', async () => {
    const insert = `INSERT INTO categories (id, name, updated_at) VALUES (gen_random_uuid(), $1, now())`;
    await querySql(db.url, insert, ['Notebooks']);
    await rejects(insert, ['notebooks']);
    await rejects(insert, ['']);
  });
});
