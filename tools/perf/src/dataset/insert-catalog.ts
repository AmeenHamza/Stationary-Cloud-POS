import { hash } from '@node-rs/argon2';

import { DATASET, PERF_USERS } from '../config.js';

import { CATEGORY_NAMES, partyRows, productRows } from './catalog-rows.js';

import type pg from 'pg';

/** Staff accounts; passwords hashed like the API does (argon2id). */
export async function insertUsers(client: pg.Client): Promise<void> {
  for (const user of Object.values(PERF_USERS)) {
    await client.query(
      `INSERT INTO users (id, username, full_name, password_hash, role, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::user_role, now())`,
      [user.username, user.fullName, await hash(user.password), user.role],
    );
  }
}

/** Categories, products (one column array per field, one statement) and their opening stock. */
export async function insertCatalog(client: pg.Client): Promise<void> {
  await client.query(
    `INSERT INTO categories (id, name, updated_at)
     SELECT gen_random_uuid(), name, now() FROM unnest($1::text[]) AS name`,
    [CATEGORY_NAMES],
  );
  const rows = productRows();
  const column = <K extends keyof (typeof rows)[number]>(key: K) => rows.map((row) => row[key]);
  await client.query(
    `WITH categories_in_order AS (
       SELECT id, row_number() OVER (ORDER BY array_position($12::text[], name::text)) - 1 AS index
       FROM categories)
     INSERT INTO products (id, barcode, name, name_key, name_urdu, category_id, pieces_per_box,
                           sale_price, box_price, cost_price, tax_rate, low_stock_threshold_pieces,
                           stock_pieces, updated_at)
     SELECT gen_random_uuid(), p.barcode, p.name, lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')),
            p.name_urdu, c.id, p.pieces, p.sale, p.box, p.cost, p.tax, p.threshold, p.stock, now()
     FROM unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::int[], $6::numeric[],
                 $7::numeric[], $8::numeric[], $9::numeric[], $10::int[], $11::int[])
          AS p(barcode, name, name_urdu, category_index, pieces, sale, box, cost, tax, threshold, stock)
     JOIN categories_in_order c ON c.index = p.category_index`,
    [
      column('barcode'),
      column('name'),
      column('nameUrdu'),
      column('categoryIndex'),
      column('piecesPerBox'),
      column('salePrice'),
      column('boxPrice'),
      column('costPrice'),
      column('taxRate'),
      column('lowStockThresholdPieces'),
      column('stockPieces'),
      CATEGORY_NAMES,
    ],
  );
  await client.query(
    `INSERT INTO stock_movements (product_id, type, quantity_pieces, balance_after)
     SELECT id, 'OPENING', stock_pieces, stock_pieces FROM products WHERE stock_pieces > 0`,
  );
}

/** Customers and vendors with made-up names and numbers. */
export async function insertParties(client: pg.Client): Promise<void> {
  for (const [table, count, prefix] of [
    ['customers', DATASET.customers, 'Customer'],
    ['vendors', DATASET.vendors, 'Supplier'],
  ] as const) {
    const rows = partyRows(count, prefix);
    await client.query(
      `INSERT INTO ${table} (id, name, name_key, phone, phone_digits, updated_at)
       SELECT gen_random_uuid(), name, lower(name), phone, regexp_replace(phone, '\\D', '', 'g'), now()
       FROM unnest($1::text[], $2::text[]) AS p(name, phone)`,
      [rows.map((row) => row.name), rows.map((row) => row.phone)],
    );
  }
}
