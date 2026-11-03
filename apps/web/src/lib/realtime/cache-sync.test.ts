import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { parse } from 'graphql';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ProductFieldsFragment } from '@/graphql/fragments/product.fragments';

import { applyProductChanged } from './handlers/product-changed';
import { applyStockChanged } from './handlers/stock-changed';
import { reconcile } from './reconcile';

import type { EventOf } from './event-types';

/** The fields a `product.changed` snapshot carries (no category name, no cost). */
const SNAPSHOT = {
  id: 'p1',
  barcode: null,
  name: 'Pen',
  nameUrdu: null,
  categoryId: 'c1',
  baseUnitLabel: 'Piece',
  piecesPerBox: 1,
  salePrice: '10.00',
  boxPrice: null,
  taxRate: '0.00',
  lowStockThresholdPieces: 5,
  lowStockThresholdUnit: 'PIECE' as const,
  stockPieces: 20,
  isLowStock: false,
  archivedAt: null,
  version: 5,
};

const PRODUCT = { ...SNAPSHOT, __typename: 'Product' as const, categoryName: 'Pens' };

function cacheWithProduct(): InMemoryCache {
  const cache = new InMemoryCache();
  cache.writeFragment({ id: 'Product:p1', fragment: ProductFieldsFragment, data: PRODUCT });
  return cache;
}

const stockEvent = (productId: string, version: number): EventOf<'StockChangedEvent'> => ({
  __typename: 'StockChangedEvent',
  seq: String(version),
  type: 'stock.changed',
  items: [{ productId, stockPieces: 3, isLowStock: true, version }],
});

describe('live cache patches (RT-07)', () => {
  it('applies newer stock, ignores older events and uncached products', () => {
    const cache = cacheWithProduct();
    applyStockChanged(cache, stockEvent('p1', 4));
    expect(cache.extract()['Product:p1']).toMatchObject({ stockPieces: 20, version: 5 });
    applyStockChanged(cache, stockEvent('p1', 6));
    expect(cache.extract()['Product:p1']).toMatchObject({ stockPieces: 3, isLowStock: true });
    applyStockChanged(cache, stockEvent('p2', 9));
    expect(cache.extract()['Product:p2']).toBeUndefined();
  });

  it('patches a product snapshot and drops the category name when the category moved', () => {
    const cache = cacheWithProduct();
    applyProductChanged(cache, {
      __typename: 'ProductChangedEvent',
      seq: '7',
      type: 'product.changed',
      productChange: 'UPDATED',
      productId: 'p1',
      version: 6,
      product: { ...SNAPSHOT, name: 'Gel pen', categoryId: 'c2', version: 6 },
    });
    const stored = cache.extract()['Product:p1'];
    expect(stored).toMatchObject({ name: 'Gel pen', categoryId: 'c2', version: 6 });
    expect(stored).not.toHaveProperty('categoryName');
  });
});

describe('reconcile after a reconnect (RT-06)', () => {
  it('refetches only mounted queries and evicts unused list fields', async () => {
    const requested: string[] = [];
    const DATA: Record<string, Record<string, unknown>> = {
      LowStockCount: { lowStockCount: 3 },
      Products: { products: { __typename: 'ProductConnection', nodes: [] } },
    };
    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: new ApolloLink((operation) => {
        requested.push(operation.operationName ?? '');
        return of({ data: DATA[operation.operationName ?? ''] ?? null });
      }),
    });
    const lowStock = parse('query LowStockCount { lowStockCount }');
    const products = parse('query Products { products { nodes { id } } }');
    client.writeQuery({ query: products, data: DATA['Products'] });
    const subscription = client.watchQuery({ query: lowStock }).subscribe(() => undefined);
    await client.query({ query: lowStock });
    requested.length = 0;

    await reconcile(client);

    expect(requested).toEqual(['LowStockCount']);
    expect(cache.extract()['ROOT_QUERY']).not.toHaveProperty('products');
    subscription.unsubscribe();
  });
});
