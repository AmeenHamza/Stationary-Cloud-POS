import { describe, expect, it } from 'vitest';

import { runIntegrityChecks } from '@pos/database';

import * as catalog from './support/catalog';
import * as khata from './support/khata';
import { khataEntry, moveStock, prng, refund, sell, type World } from './support/property-ops';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

const SEED = 20_261_031;
const OPERATIONS = 500;

/** Builds the catalogue and parties through the API, so every row has its ledger history. */
async function world(): Promise<World> {
  const rand = prng(SEED);
  const products = [];
  for (const [index, fields] of [
    { salePrice: '33.33', boxPrice: '380.00', piecesPerBox: 12, taxRate: '5' },
    { salePrice: '120.00', boxPrice: null, piecesPerBox: 1, taxRate: '0' },
    { salePrice: '7.50', boxPrice: '70.00', piecesPerBox: 10, taxRate: '0' },
    { salePrice: '450.00', boxPrice: null, piecesPerBox: 1, taxRate: '17' },
    { salePrice: '19.99', boxPrice: '210.00', piecesPerBox: 12, taxRate: '10' },
  ].entries()) {
    const created = await catalog.createProduct(t.h.url, t.admin, {
      ...fields,
      name: `Property item ${String(index)}`,
      initialStockPieces: 200,
    });
    products.push({ id: created.id, ...fields });
  }
  const customers = [];
  for (const name of ['Prop Customer A', 'Prop Customer B', 'Prop Customer C']) {
    customers.push((await khata.createCustomer(t.h.url, t.cashier, { name })).id);
  }
  const vendors = [];
  for (const name of ['Prop Vendor A', 'Prop Vendor B']) {
    const response = await asUser<{ createVendor: { id: string } }>(
      t.h.url,
      t.cashier,
      khata.CREATE_VENDOR,
      { input: { name } },
    );
    vendors.push(khata.dataOf(response).createVendor.id);
  }
  return { t, rand, products, customers, vendors, orders: [] };
}

describe('integrity after random activity (FIN-22, DATABASE.md §12)', () => {
  it(`keeps stock, khata, bill and refund arithmetic exact over ${String(OPERATIONS)} operations`, async () => {
    const w = await world();
    const counts = { sale: 0, refund: 0, stock: 0, khata: 0 };
    for (let step = 0; step < OPERATIONS; step += 1) {
      const roll = w.rand();
      if (roll < 0.4) {
        counts.sale += 1;
        await sell(w);
      } else if (roll < 0.6) {
        counts.refund += 1;
        await refund(w);
      } else if (roll < 0.8) {
        counts.stock += 1;
        await moveStock(w);
      } else {
        counts.khata += 1;
        await khataEntry(w);
      }
    }
    expect(Object.values(counts).every((count) => count > 50)).toBe(true);
    const results = await runIntegrityChecks((sql) => t.prisma.$queryRaw(sql));
    expect(results.map((r) => r.name)).toHaveLength(6);
    for (const result of results) {
      expect(result, `${result.name} (seed ${String(SEED)})`).toMatchObject({ count: 0, ids: [] });
    }
  }, 300_000);
});
