import { describe, expect, it } from 'vitest';

import * as catalog from './support/catalog';
import { dataOf } from './support/graphql-client';
import * as khata from './support/khata';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const bytesOf = (body: unknown): number => Buffer.byteLength(JSON.stringify(body));

/** What the terminal selects for a scan and a sale (web `terminal.documents.ts`, `sale.documents.ts`). */
const SALE_PRODUCT = `__typename id name nameUrdu baseUnitLabel piecesPerBox salePrice boxPrice taxRate
  stockPieces isLowStock archivedAt version`;
const SCAN = `query ProductByBarcode($barcode: String!) {
  productByBarcode(barcode: $barcode) { ${SALE_PRODUCT} } }`;
const TERMINAL_SALE = `mutation CreateSale($input: CreateSaleInput!) { createSale(input: $input) {
  __typename replayed
  order { __typename id billNumber businessDate createdAt cashierName customerName paymentMethod
    subtotal discountType discountValue discountTotal productTaxTotal billGstRate billGstAmount total
    refundedTotal status version }
  receipt { __typename orderId billNumber createdAt shopName address phone footer cashierName
    customerName customerBalance paymentMethod subtotal discountTotal productTaxTotal billGstRate
    billGstAmount total lines { __typename name nameUrdu quantity unit unitPrice lineTotal } }
  stockWarnings { __typename productId productName stockAfter } } }`;

/** Three products with realistic names and barcodes, created as the admin screen would. */
async function threeProducts(prefix: string): Promise<{ id: string; barcode: string }[]> {
  const products = [];
  for (const index of [1, 2, 3]) {
    const barcode = `${prefix}${String(index).padStart(4, '0')}`;
    const product = await catalog.createProduct(t.h.url, t.admin, {
      barcode,
      name: `Long ruled register 200 pages ${prefix}-${String(index)}`,
      nameUrdu: 'رجسٹر دو سو صفحات',
      salePrice: '450.00',
      taxRate: '5',
    });
    products.push({ id: product.id, barcode });
  }
  return products;
}

/** Three scans and the sale, as one counter sends them for a 3-line bill. */
async function scanAndSell(products: readonly { id: string; barcode: string }[]) {
  for (const product of products) {
    await asUser(t.h.url, t.cashier, SCAN, { barcode: product.barcode });
  }
  const lines = products.map((product) => ({ productId: product.id }));
  const input = sales.saleInput(lines, {
    billGst: { applied: true, rate: '18' },
    expectedTotal: '1672.65',
  });
  return asUser<sales.SaleResult>(t.h.url, t.cashier, TERMINAL_SALE, { input });
}

describe('billing transfer budgets (NETWORK_OPTIMIZATION.md §4.1–§4.2)', () => {
  it('a scan-based 3-line bill moves ≤ 25 KB to and from PostgreSQL (NET-03)', async () => {
    await scanAndSell(await threeProducts('89601')); // warm-up: session cached, plans prepared
    const products = await threeProducts('89602');
    t.h.dbBytes.reset();
    const sale = await scanAndSell(products);
    const transferred = t.h.dbBytes.total;
    expect(dataOf(sale).createSale.order.total).toBe('1672.65');
    expect(transferred).toBeGreaterThan(0);
    expect(transferred).toBeLessThanOrEqual(25 * 1_024);
  });

  it('keeps a scan ≤ 1.5 KB and the sale response with its receipt ≤ 6 KB', async () => {
    const products = await threeProducts('89603');
    const scan = await asUser(t.h.url, t.cashier, SCAN, { barcode: products[0]?.barcode });
    expect(bytesOf(scan.body)).toBeLessThanOrEqual(1_536);
    const sale = await scanAndSell(products);
    expect(sale.body.errors).toBeUndefined();
    expect(bytesOf(sale.body)).toBeLessThanOrEqual(6 * 1_024);
  });
});

describe('Redis holds no business records (RED-11, rule 5)', () => {
  it('after sales, refunds and khata activity, only sessions, reference data and limits', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '12' });
    const customer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Cache Probe' });
    const sale = await asUser<sales.SaleResult>(t.h.url, t.cashier, sales.CREATE_SALE, {
      input: sales.saleInput([{ productId: id }], {
        paymentMethod: 'UDHAAR',
        customerId: customer.id,
        expectedTotal: '12.00',
      }),
    });
    const orderId = dataOf(sale).createSale.order.id;
    await asUser(t.h.url, t.cashier, sales.REFUND, {
      input: { ...khata.entryInput({ orderId, refundAll: true }), expectedAmount: '12.00' },
    });
    await asUser(t.h.url, t.cashier, `{ shopSettings { shopName } categories { nodes { id } } }`);

    const redis = t.h.redis('cache');
    const keys = await redis.keys('*');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      // The import queue's own keys are work items (an import job id), never records (ADR-020).
      expect(key).toMatch(/^pos:v1:(sess|gen|ref:(categories|settings)|rl|bull:product-import):/);
      expect(key).not.toContain(id);
      expect(key).not.toContain(customer.id);
      expect(key).not.toContain(orderId);
    }
    const values = await Promise.all(
      keys.filter((key) => key.includes(':ref:')).map((key) => redis.get(key)),
    );
    for (const value of values) {
      expect(value ?? '').not.toMatch(/stockPieces|stock_pieces|balance|billNumber|Cache Probe/);
    }
  });
});
