import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildSchema, getNamedType, isNonNullType } from 'graphql';
import { beforeAll, describe, expect, it } from 'vitest';

import { normalizeNameKey } from '@pos/domain';

import * as catalog from './support/catalog';
import { errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

const bytesOf = (body: unknown): number => Buffer.byteLength(JSON.stringify(body));

beforeAll(async () => {
  const category = await catalog.createCategory(t.h.url, t.admin, 'Registers');
  await t.prisma.product.createMany({
    data: Array.from({ length: 60 }, (_, index) => {
      const name = `Long ruled register 200 pages ${String(index).padStart(2, '0')}`;
      return {
        id: randomUUID(),
        barcode: `8964${String(index).padStart(9, '0')}`,
        name,
        nameKey: normalizeNameKey(name),
        nameUrdu: 'رجسٹر دو سو صفحات',
        categoryId: category.id,
        salePrice: '450.00',
        boxPrice: '5200.00',
        costPrice: '380.00',
        piecesPerBox: 12,
        stockPieces: 40,
      };
    }),
  });
});

/** Statements the API sends to PostgreSQL for one request, after a warm-up call (session cached). */
async function statementsFor(query: string, variables: Record<string, unknown> = {}) {
  await asUser(t.h.url, t.admin, query, variables);
  t.h.statements.reset();
  const response = await asUser(t.h.url, t.admin, query, variables);
  expect(response.body.errors).toBeUndefined();
  return t.h.statements.count;
}

describe('response budgets (NET-01, NETWORK_OPTIMIZATION.md §4.2)', () => {
  it('keeps a barcode lookup under 1.5 KB and a page of 50 admin rows under 25 KB', async () => {
    const scan = await asUser(
      t.h.url,
      t.admin,
      `query B($barcode: String!) { productByBarcode(barcode: $barcode) { ${catalog.PRODUCT_FIELDS} } }`,
      { barcode: '8964000000007' },
    );
    expect(bytesOf(scan.body)).toBeLessThanOrEqual(1_536);
    const page = await asUser(
      t.h.url,
      t.admin,
      // Exactly what the admin Products screen sends (ProductFields; Apollo adds __typename).
      `{ products(first: 50) { __typename nodes { __typename ${catalog.PRODUCT_FIELDS} }
        pageInfo { __typename hasNextPage endCursor } totalCount } }`,
    );
    expect(bytesOf(page.body)).toBeLessThanOrEqual(25 * 1_024);
  });
});

describe('statements per list request (NET-02, PAG-07)', () => {
  it('reads a page in one or two statements, and counts only when totalCount is selected', async () => {
    const LISTS = [
      'products(first: 50, sort: PRICE_DESC)',
      'lowStockProducts(first: 50)',
      'categories(first: 50, filter: { search: "reg" })', // not the cached first page
      'staffUsers(first: 50)',
    ];
    for (const list of LISTS) {
      const withoutTotal = await statementsFor(
        `{ ${list} { nodes { id } pageInfo { hasNextPage } } }`,
      );
      const withTotal = await statementsFor(`{ ${list} { nodes { id } totalCount } }`);
      expect(withoutTotal, list).toBeLessThanOrEqual(2); // page (+ grouped counts for categories)
      expect(withTotal - withoutTotal, list).toBe(1); // the COUNT runs only when selected
      expect(withTotal, list).toBeLessThanOrEqual(3);
    }
  });
});

describe('every connection in the schema (PAG-09)', () => {
  const schemaFile = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'packages',
    'contracts',
    'schema.graphql',
  );
  const query = buildSchema(readFileSync(schemaFile, 'utf8')).getQueryType();
  const connections = Object.values(query?.getFields() ?? {}).filter(
    (field) =>
      getNamedType(field.type).name.endsWith('Connection') &&
      field.args.every((arg) => !isNonNullType(arg.type) || arg.defaultValue !== undefined),
  );

  it('finds the connections to check', () => {
    expect(connections.map((field) => field.name)).toEqual(
      expect.arrayContaining(['categories', 'lowStockProducts', 'products', 'staffUsers']),
    );
  });

  it.each(connections.map((field) => field.name))(
    '%s: defaults to ≤ 50, refuses first: 51 and a malformed cursor',
    async (name) => {
      const page = await asUser<Record<string, { nodes: unknown[] }>>(
        t.h.url,
        t.admin,
        `{ ${name} { nodes { __typename } } }`,
      );
      expect(page.body.data?.[name]?.nodes.length).toBeLessThanOrEqual(50);
      const tooMany = await asUser(
        t.h.url,
        t.admin,
        `{ ${name}(first: 51) { nodes { __typename } } }`,
      );
      expect(errorCode(tooMany)).toBe('BAD_USER_INPUT');
      const badCursor = await asUser(
        t.h.url,
        t.admin,
        `{ ${name}(after: "not-a-cursor") { nodes { __typename } } }`,
      );
      expect(errorCode(badCursor)).toBe('BAD_CURSOR');
    },
  );
});
