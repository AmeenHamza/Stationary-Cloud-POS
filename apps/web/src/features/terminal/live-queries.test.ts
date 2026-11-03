import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { getOperationAST } from 'graphql';
import { Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { TYPE_POLICIES } from '@/lib/apollo/type-policies';
import { LIVE_QUERIES } from '@/lib/realtime/live-queries';

import {
  CartProductsDocument,
  SaleProductFieldsFragment,
  TerminalProductsDocument,
} from './graphql/terminal.documents';

const PEN = {
  __typename: 'Product' as const,
  id: 'p1',
  name: 'Pen',
  nameUrdu: null,
  baseUnitLabel: 'Piece',
  piecesPerBox: 1,
  salePrice: '10.00',
  boxPrice: null,
  taxRate: '0.00',
  stockPieces: 20,
  isLowStock: false,
  archivedAt: null,
  version: 1,
};

/** A client whose network counts requests and answers `productsByIds` with the pen. */
function clientWithPen() {
  const requests: string[] = [];
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        requests.push(operation.operationName ?? '');
        observer.next({ data: { productsByIds: [PEN] } });
        observer.complete();
      }),
  );
  const cache = new InMemoryCache({ typePolicies: TYPE_POLICIES });
  return { client: new ApolloClient({ cache, link }), cache, requests };
}

describe('terminal queries (SYSTEM_DESIGN.md §3.1, §5.4)', () => {
  it('the product grid is refetched with the other product lists', () => {
    expect(LIVE_QUERIES.products).toContain(getOperationAST(TerminalProductsDocument)?.name?.value);
  });

  it('reads cart products from the cache when the grid already loaded them', async () => {
    const { client, cache, requests } = clientWithPen();
    cache.writeFragment({ id: 'Product:p1', fragment: SaleProductFieldsFragment, data: PEN });
    const { data } = await client.query({
      query: CartProductsDocument,
      variables: { ids: ['p1'] },
    });
    expect(data?.productsByIds.map((product) => product.name)).toEqual(['Pen']);
    expect(requests).toEqual([]);
  });

  it('fetches cart products the cache lacks (a cart restored after a reload)', async () => {
    const { client, requests } = clientWithPen();
    const { data } = await client.query({
      query: CartProductsDocument,
      variables: { ids: ['p1'] },
    });
    expect(data?.productsByIds[0]?.id).toBe('p1');
    expect(requests).toEqual(['CartProducts']);
  });
});
