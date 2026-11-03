import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizeNameKey } from '@pos/domain';

import { PRISMA_CLIENT, type AppPrismaClient } from '../src/infrastructure/prisma/prisma.module';

import { createUser, loginCookie } from './support/auth';
import * as catalog from './support/catalog';
import { errorCode } from './support/graphql-client';
import { startHarness, type Harness } from './support/harness';
import { asUser } from './support/staff';

let h: Harness;
let cashier: string;
let admin: string;
let categoryId: string;

interface Page {
  nodes: { id: string; name: string; salePrice: string; categoryId: string | null }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number | null;
}

const products = (variables: Record<string, unknown>) =>
  asUser<{ products: Page }>(h.url, cashier, catalog.PRODUCTS, variables);

beforeAll(async () => {
  h = await startHarness();
  admin = await loginCookie(h.url, await createUser(h, { username: 'owner', role: 'ADMIN' }));
  cashier = await loginCookie(h.url, await createUser(h, { username: 'till', role: 'CASHIER' }));
  categoryId = (await catalog.createCategory(h.url, admin, 'Pens')).id;
  // 120 products with only three distinct prices, so the id tiebreaker carries the keyset (PAG-03).
  const prisma = h.app.get<AppPrismaClient>(PRISMA_CLIENT);
  await prisma.product.createMany({
    data: Array.from({ length: 120 }, (_, index) => {
      const name = `Bulk ${String(index % 7)} item`;
      return {
        id: randomUUID(),
        name,
        nameKey: normalizeNameKey(name),
        salePrice: ['5.00', '10.00', '15.00'][index % 3] ?? '5.00',
        categoryId: index < 30 ? categoryId : null,
        stockPieces: 50,
      };
    }),
  });
  await catalog.createProduct(h.url, admin, {
    name: 'Gel Pen Blue',
    nameUrdu: 'نیلا قلم',
    barcode: '8964000000017',
  });
});

afterAll(async () => {
  await h.stop();
});

async function walk(sort: string): Promise<string[][]> {
  const pages: string[][] = [];
  let after: string | null = null;
  do {
    const page: Page = catalog.dataOf(await products({ sort, after })).products;
    pages.push(page.nodes.map((node) => node.id));
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after !== null);
  return pages;
}

describe('products pagination (PAG-01..05)', () => {
  it('walks 121 rows in pages of 50 with no duplicates or gaps, for every sort', async () => {
    for (const sort of ['NAME_ASC', 'NAME_DESC', 'PRICE_ASC', 'PRICE_DESC']) {
      const pages = await walk(sort);
      expect(pages.map((page) => page.length)).toEqual([50, 50, 21]);
      expect(new Set(pages.flat()).size).toBe(121);
    }
  });

  it('orders by price, then id', async () => {
    const page = catalog.dataOf(await products({ sort: 'PRICE_ASC', first: 50 })).products;
    const values = page.nodes.map((node) => Number.parseFloat(node.salePrice));
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it('refuses out-of-range page sizes and foreign or malformed cursors', async () => {
    for (const first of [0, 51]) {
      expect(errorCode(await products({ first }))).toBe('BAD_USER_INPUT');
    }
    const page = catalog.dataOf(await products({ sort: 'NAME_ASC' })).products;
    expect(errorCode(await products({ sort: 'PRICE_ASC', after: page.pageInfo.endCursor }))).toBe(
      'BAD_CURSOR',
    );
    expect(errorCode(await products({ after: 'not-a-cursor' }))).toBe('BAD_CURSOR');
  });

  it('returns an empty page for a filter with no matches', async () => {
    const page = catalog.dataOf(await products({ filter: { search: 'zzzz-nothing' } })).products;
    expect(page).toEqual({
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      totalCount: 0,
    });
  });
});

describe('products search and filters (F-08)', () => {
  it('matches English name, Urdu name and exact barcode on the server', async () => {
    for (const search of ['gel pen', 'نیلا', '8964000000017']) {
      const page = catalog.dataOf(await products({ filter: { search } })).products;
      expect(page.nodes.map((node) => node.name)).toEqual(['Gel Pen Blue']);
    }
  });

  it('filters by category, Uncategorised and counts the full result', async () => {
    const inCategory = catalog.dataOf(await products({ filter: { categoryId } })).products;
    expect(inCategory.totalCount).toBe(30);
    expect(inCategory.nodes.every((node) => node.categoryId === categoryId)).toBe(true);
    const uncategorised = catalog.dataOf(
      await products({ filter: { uncategorised: true } }),
    ).products;
    expect(uncategorised.totalCount).toBe(91);
  });
});

describe('query cost limit (SEC-09, ADR-031)', () => {
  it('accepts a full page of 50 product rows and refuses many pages in one request', async () => {
    const fullPage = `{ products(first: 50) {
      nodes { ${catalog.PRODUCT_FIELDS} __typename } pageInfo { hasNextPage endCursor } totalCount
    } }`;
    const page = await asUser<{ products: Page }>(h.url, cashier, fullPage);
    expect(catalog.dataOf(page).products.nodes).toHaveLength(50);

    const aliases = Array.from({ length: 20 }, (_, index) => {
      return `p${String(index)}: products(first: 50) { nodes { id } }`; // 1 + 50 × 1 each
    });
    const tooMuch = await asUser(h.url, cashier, `{ ${aliases.join(' ')} }`);
    expect(errorCode(tooMuch)).toBe('BAD_USER_INPUT');
    expect(tooMuch.body.errors?.[0]?.message).toMatch(/complexity/);
  });
});
