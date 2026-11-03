import { describe, expect, it } from 'vitest';

import { MAX_EVENT_BYTES } from '@pos/contracts';

import * as catalog from './support/catalog';
import { errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

const SETTINGS =
  '{ shopSettings { shopName address phone receiptFooter defaultBillGstRate version updatedAt } }';
const UPDATE = `mutation U($input: UpdateShopSettingsInput!) {
  updateShopSettings(input: $input) { shopName defaultBillGstRate version }
}`;

interface Settings {
  shopName: string;
  defaultBillGstRate: string;
  version: number;
  updatedAt: string;
}

const read = async (cookie: string) =>
  catalog.dataOf(await asUser<{ shopSettings: Settings }>(t.h.url, cookie, SETTINGS)).shopSettings;

const outbox = (type: string) =>
  t.prisma.outboxEvent.findMany({
    where: { type },
    orderBy: { seq: 'asc' },
    select: { audience: true, payload: true },
  });

describe('shop settings (Q26)', () => {
  it('every role reads; admins update with the current version; the cache follows (RED-03)', async () => {
    const before = await read(t.cashier);
    expect(before).toMatchObject({ shopName: 'Stationery Shop', defaultBillGstRate: '18.00' });
    expect(before.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/); // also when served from cache
    const input = {
      shopName: 'Main Street Stationers',
      address: 'Shop 4, Main Street',
      phone: null,
      receiptFooter: 'Thank you!',
      defaultBillGstRate: '17.5',
      version: before.version,
    };
    const updated = await asUser<{ updateShopSettings: Settings }>(t.h.url, t.admin, UPDATE, {
      input,
    });
    expect(catalog.dataOf(updated).updateShopSettings).toMatchObject({
      shopName: 'Main Street Stationers',
      defaultBillGstRate: '17.50',
      version: before.version + 1,
    });
    expect(await read(t.cashier)).toMatchObject({ shopName: 'Main Street Stationers', version: 2 });

    expect(errorCode(await asUser(t.h.url, t.admin, UPDATE, { input }))).toBe('CONFLICT');
    expect(errorCode(await asUser(t.h.url, t.cashier, UPDATE, { input }))).toBe('FORBIDDEN');
    const invalid = await asUser(t.h.url, t.admin, UPDATE, {
      input: { ...input, version: 2, defaultBillGstRate: '101' },
    });
    expect(errorCode(invalid)).toBe('BAD_USER_INPUT');

    expect(await outbox('settings.changed')).toEqual([
      { audience: 'staff', payload: { version: 2 } },
    ]);
  });
});

describe('catalogue event payloads (RT-01, API.md §7.2)', () => {
  it('emits product, stock, low-stock and category events with public fields only', async () => {
    const category = await catalog.createCategory(t.h.url, t.admin, 'Markers');
    const product = await catalog.createProduct(t.h.url, t.admin, {
      categoryId: category.id,
      costPrice: '4.25',
      lowStockThreshold: 10,
      initialStockPieces: 3,
    });
    await asUser(t.h.url, t.admin, catalog.RESTOCK, {
      input: catalog.restockInput(product.id, { pieces: 20 }),
    });

    const [created] = await outbox('product.changed');
    expect(created).toMatchObject({
      audience: 'staff',
      payload: {
        change: 'CREATED',
        productId: product.id,
        version: 1,
        product: { salePrice: '10.00' },
      },
    });
    expect(JSON.stringify(created?.payload)).not.toContain('costPrice');
    expect(await outbox('stock.changed')).toEqual([
      {
        audience: 'staff',
        payload: {
          items: [{ productId: product.id, stockPieces: 23, isLowStock: false, version: 2 }],
        },
      },
    ]);
    // Entered the low-stock list on creation and left it on restock: two signals, admins only.
    expect(await outbox('lowStock.countChanged')).toEqual([
      { audience: 'admin', payload: { crossedProductIds: [product.id] } },
      { audience: 'admin', payload: { crossedProductIds: [product.id] } },
    ]);
    const [categoryEvent] = await outbox('category.changed');
    expect(categoryEvent).toMatchObject({
      audience: 'staff',
      payload: { change: 'CREATED', categoryId: category.id, category: { name: 'Markers' } },
    });
  });

  it('keeps every event within 1 KB, nulling an oversized product snapshot (RT-10)', async () => {
    const long = await catalog.createProduct(t.h.url, t.admin, {
      name: 'N'.repeat(200),
      nameUrdu: 'ق'.repeat(200),
      barcode: 'B'.repeat(64),
    });
    const rows = await t.prisma.outboxEvent.findMany({ select: { type: true, payload: true } });
    for (const row of rows) {
      expect(Buffer.byteLength(JSON.stringify(row.payload))).toBeLessThanOrEqual(MAX_EVENT_BYTES);
    }
    const events = await outbox('product.changed');
    expect(events.at(-1)?.payload).toMatchObject({ productId: long.id, product: null });
  });
});
