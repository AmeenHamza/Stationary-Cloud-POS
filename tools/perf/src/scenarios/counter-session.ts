import { randomUUID } from 'node:crypto';

import { calculateBill, Decimal } from '@pos/domain';

import { WORKLOAD } from '../config.js';
import { linesForBill, type Random } from '../random.js';

import * as op from './operations.js';

import type { GraphqlSession } from '../measure/http-client.js';

/** What the simulation knows about the catalogue (read before measuring, never measured). */
export interface CatalogSample {
  products: { barcode: string; name: string }[];
  customerSearches: string[];
}

type SaleProduct = NonNullable<Awaited<ReturnType<typeof scan>>>;

const scan = async (tab: GraphqlSession, barcode: string) =>
  (await tab.run(op.ProductByBarcodeDocument, { barcode })).productByBarcode;

/** The terminal opening (the queries its screen sends on load). */
export async function openTerminal(tab: GraphqlSession): Promise<void> {
  await tab.run(op.MeDocument, {});
  await tab.run(op.ServerInfoDocument, {});
  await tab.run(op.ShopSettingsDocument, {});
  await tab.run(op.CategoryOptionsDocument, {});
  await tab.run(op.TerminalProductsDocument, {});
}

/** Two searches as the cashier types, then the product picked from the second result page. */
async function searchFor(tab: GraphqlSession, name: string): Promise<SaleProduct> {
  const words = name.split(' ');
  await tab.run(op.TerminalProductsDocument, { filter: { search: words.slice(0, 2).join(' ') } });
  const page = await tab.run(op.TerminalProductsDocument, { filter: { search: name } });
  const product = page.products.nodes[0];
  if (product === undefined) {
    throw new Error(`no search result for ${name}`);
  }
  return product;
}

export interface SoldBill {
  billNumber: string;
  orderId: string;
  total: string;
  lines: number;
  scannedLines: number;
}

/** One bill (§8.2 mix): lines by scan or search, Udhaar now and then, priced like the terminal. */
export async function sellBill(
  tab: GraphqlSession,
  catalog: CatalogSample,
  random: Random,
): Promise<SoldBill> {
  const count = linesForBill(random, WORKLOAD.meanLinesPerBill);
  const products = new Map<string, SaleProduct>();
  let scannedLines = 0;
  while (products.size < count) {
    const target = random.pick(catalog.products);
    const scanned = random.chance(WORKLOAD.scannedLineShare);
    const product = scanned ? await scan(tab, target.barcode) : await searchFor(tab, target.name);
    if (product !== null && !products.has(product.id)) {
      products.set(product.id, product);
      scannedLines += scanned ? 1 : 0;
    }
  }
  const lines = [...products.values()].map((product) => ({
    product,
    quantity: random.int(1, 3),
  }));
  const bill = calculateBill(
    lines.map(({ product, quantity }) => ({
      unitPrice: new Decimal(product.salePrice),
      quantity,
      taxRate: new Decimal(product.taxRate),
    })),
    { type: 'NONE' },
    { applied: false },
  );
  let customerId: string | null = null;
  if (random.chance(WORKLOAD.udhaarShare)) {
    const search = random.pick(catalog.customerSearches);
    const found = await tab.run(op.CustomersDocument, { filter: { search } });
    customerId = found.customers.nodes[0]?.id ?? null;
  }
  const sale = await tab.run(op.CreateSaleDocument, {
    input: {
      idempotencyKey: randomUUID(),
      lines: lines.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
        unit: 'PIECE' as const,
      })),
      discount: { type: 'NONE' },
      billGst: { applied: false },
      paymentMethod: customerId === null ? 'CASH' : 'UDHAAR',
      customerId,
      expectedTotal: bill.total.toFixed(2),
    },
  });
  const order = sale.createSale.order;
  return {
    billNumber: order.billNumber,
    orderId: order.id,
    total: order.total,
    lines: count,
    scannedLines,
  };
}

/** A full refund from the terminal: find the bill, open it, refund all (F-21). */
export async function refundBill(tab: GraphqlSession, bill: SoldBill): Promise<void> {
  await tab.run(op.OrdersDocument, { filter: { billNumberPrefix: bill.billNumber } });
  const detail = await tab.run(op.OrderDetailDocument, { id: bill.orderId });
  if (detail.order === null) {
    throw new Error(`order ${bill.billNumber} not found`);
  }
  await tab.run(op.RefundOrderDocument, {
    input: {
      idempotencyKey: randomUUID(),
      orderId: bill.orderId,
      refundAll: true,
      expectedAmount: detail.order.total,
    },
  });
}
