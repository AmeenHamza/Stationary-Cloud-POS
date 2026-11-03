import { describe, expect, it } from 'vitest';

import { checkPagination } from '../check-graphql-pagination.js';

const BASE = `
  type PageInfo { hasNextPage: Boolean! endCursor: String }
  type Product { id: ID! name: String! }
  type ProductConnection { nodes: [Product!]! pageInfo: PageInfo! totalCount: Int }
  type OrderLine { id: ID! }
  type Order { id: ID! lines: [OrderLine!]! tags: [String!]! }
`;

describe('checkPagination', () => {
  it('accepts connections with first and after, and scalar lists', () => {
    const sdl = `${BASE} type Query { products(first: Int = 50, after: String): ProductConnection! }`;
    expect(
      checkPagination(sdl, [{ field: 'Order.lines', bound: 100, reason: 'one bill' }]),
    ).toEqual([]);
  });

  it('flags a connection without cursor arguments', () => {
    const sdl = `${BASE} type Query { products: ProductConnection! }`;
    const rules = checkPagination(sdl, [{ field: 'Order.lines', bound: 100, reason: 'one bill' }]);
    expect(rules.map((f) => f.rule)).toEqual(['connection-args']);
  });

  it('flags plain object lists that are not allow-listed', () => {
    const sdl = `${BASE} type Query { allProducts: [Product!]! }`;
    const rules = checkPagination(sdl, [{ field: 'Order.lines', bound: 100, reason: 'one bill' }]);
    expect(rules.map((f) => f.detail)).toEqual([
      'Query.allProducts is an unpaginated list; use a Connection or allow-list it with a bound',
    ]);
  });

  it('flags stale and incomplete allow-list entries', () => {
    const sdl = `${BASE} type Query { products(first: Int, after: String): ProductConnection! }`;
    const rules = checkPagination(sdl, [
      { field: 'Order.lines', bound: 0, reason: '' },
      { field: 'Query.gone', bound: 5, reason: 'removed' },
    ]);
    expect(rules.map((f) => f.rule).sort()).toEqual(['allowlist-entry', 'stale-allowlist']);
  });
});
