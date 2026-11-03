import { randomUUID } from 'node:crypto';

import {
  billDiscountOf,
  billGstOf,
  calculateBill,
  money,
  percent,
  toMoneyString,
} from '@pos/domain';

import * as catalog from './catalog';
import { dataOf } from './graphql-client';
import * as khata from './khata';
import * as sales from './sales';
import { asUser } from './staff';

import type { RoleHarness } from './roles';

/** Deterministic PRNG (mulberry32): a failing run replays from its seed. */
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface World {
  t: RoleHarness;
  rand: () => number;
  products: { id: string; salePrice: string; boxPrice: string | null; taxRate: string }[];
  customers: string[];
  vendors: string[];
  orders: string[];
}

const pick = <T>(world: World, items: readonly T[]): T => {
  const item = items[Math.floor(world.rand() * items.length)];
  if (item === undefined) throw new Error('empty choice');
  return item;
};
const between = (world: World, low: number, high: number): number =>
  low + Math.floor(world.rand() * (high - low + 1));

/** A random 1–3 line sale, priced with the shared domain function for `expectedTotal`. */
export async function sell(world: World): Promise<void> {
  const chosen = new Map<string, { productId: string; unit: 'PIECE' | 'BOX'; quantity: number }>();
  for (let i = between(world, 1, 3); i > 0; i -= 1) {
    const product = pick(world, world.products);
    const unit = product.boxPrice !== null && world.rand() < 0.3 ? 'BOX' : 'PIECE';
    chosen.set(`${product.id}:${unit}`, {
      productId: product.id,
      unit,
      quantity: between(world, 1, 3),
    });
  }
  const lines = [...chosen.values()];
  const discount = pick(world, [
    { type: 'NONE' },
    { type: 'FLAT', amount: '1.00' },
    { type: 'PERCENT', percent: '7.5' },
  ] as const);
  const billGst = world.rand() < 0.4 ? { applied: true, rate: '18' } : { applied: false };
  const udhaar = world.rand() < 0.3;
  const bill = calculateBill(
    lines.map((line) => {
      const product = world.products.find((p) => p.id === line.productId);
      const price = line.unit === 'BOX' ? product?.boxPrice : product?.salePrice;
      return {
        unitPrice: money(price ?? '0'),
        quantity: line.quantity,
        taxRate: percent(product?.taxRate ?? '0'),
      };
    }),
    billDiscountOf(discount),
    billGstOf(billGst),
  );
  const result = await asUser<sales.SaleResult>(world.t.h.url, world.t.cashier, sales.CREATE_SALE, {
    input: {
      ...sales.saleInput(lines, { discount, billGst, expectedTotal: toMoneyString(bill.total) }),
      paymentMethod: udhaar ? 'UDHAAR' : pick(world, ['CASH', 'CARD', 'EASYPAISA']),
      customerId: udhaar ? pick(world, world.customers) : null,
    },
  });
  world.orders.push(dataOf(result).createSale.order.id);
}

interface Detail {
  order: { lines: { id: string; quantity: number; refundedQuantity: number }[]; status: string };
}

/** Refunds one unit of a random line with something left, or everything left (A-06 amounts). */
export async function refund(world: World): Promise<void> {
  if (world.orders.length === 0) return;
  const orderId = pick(world, world.orders);
  const { order } = dataOf(
    await asUser<Detail>(world.t.h.url, world.t.cashier, sales.ORDER, { id: orderId }),
  );
  const open = order.lines.filter((line) => line.refundedQuantity < line.quantity);
  if (open.length === 0) return;
  const request =
    world.rand() < 0.3
      ? { refundAll: true }
      : { lines: [{ orderLineId: pick(world, open).id, quantity: 1 }] };
  const send = (expectedAmount: unknown) =>
    asUser<sales.RefundResult>(world.t.h.url, world.t.cashier, sales.REFUND, {
      input: { idempotencyKey: randomUUID(), orderId, ...request, expectedAmount },
    });
  const quote = await send('0.01'); // QUOTE_MISMATCH tells the exact amount
  const amount = quote.body.errors?.[0]?.extensions?.['amount'];
  dataOf(amount === undefined ? quote : await send(amount));
}

/** Restock (+) or an adjustment either way, as an admin. */
export async function moveStock(world: World): Promise<void> {
  const product = pick(world, world.products);
  const [query, input] =
    world.rand() < 0.5
      ? [catalog.RESTOCK, catalog.restockInput(product.id, { pieces: between(world, 1, 10) })]
      : [
          catalog.ADJUST,
          {
            idempotencyKey: randomUUID(),
            productId: product.id,
            direction: world.rand() < 0.5 ? 'INCREASE' : 'DECREASE',
            quantityPieces: between(world, 1, 5),
            reason: 'COUNT_CORRECTION',
            note: null,
          },
        ];
  dataOf(await asUser(world.t.h.url, world.t.admin, query, { input }));
}

/** A manual khata entry on a random customer or vendor. */
export async function khataEntry(world: World): Promise<void> {
  const amount = `${String(between(world, 1, 500))}.${String(between(world, 10, 99))}`;
  const customer = world.rand() < 0.6;
  const raise = world.rand() < 0.5;
  const [query, partyKey] = customer
    ? [raise ? khata.ADD_CREDIT : khata.RECEIVE_PAYMENT, 'customerId']
    : [raise ? khata.ADD_PURCHASE : khata.PAY_VENDOR, 'vendorId'];
  const partyId = pick(world, customer ? world.customers : world.vendors);
  const input = khata.entryInput({
    [partyKey]: partyId,
    amount,
    ...(raise ? {} : { method: 'CASH' }),
  });
  dataOf(await asUser(world.t.h.url, world.t.cashier, query, { input }));
}
