import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { from, of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { TYPE_POLICIES } from '@/lib/apollo/type-policies';

import { SaleProductFieldsFragment } from '../graphql/terminal.documents';

import { useCartProducts } from './useCartProducts';

import type { CartLine } from '../state/cart.types';
import type { ReactNode } from 'react';

const product = (id: string) => ({
  __typename: 'Product' as const,
  id,
  name: `Item ${id}`,
  nameUrdu: null,
  baseUnitLabel: 'Piece',
  piecesPerBox: 1,
  salePrice: '10.00',
  boxPrice: null,
  taxRate: '0.00',
  stockPieces: 5,
  isLowStock: false,
  archivedAt: null,
  version: 1,
});

const linesOf = (...ids: string[]): CartLine[] =>
  ids.map((productId) => ({ productId, unit: 'PIECE', quantity: 1 }));

/**
 * The real cache and type policy against a fake server. `everMissing` keeps every id any render
 * called missing: the terminal removes those lines at once, so one wrong render would lose an item.
 */
function setUp(options: { server: string[]; cached?: string[]; gate?: Promise<void> }) {
  const server = new Set(options.server);
  const cache = new InMemoryCache({ typePolicies: TYPE_POLICIES });
  for (const id of options.cached ?? []) {
    cache.writeFragment({
      id: `Product:${id}`,
      fragment: SaleProductFieldsFragment,
      data: product(id),
    });
  }
  const answer = (ids: string[]) => ({
    data: { productsByIds: ids.filter((id) => server.has(id)).map(product) },
  });
  const link = new ApolloLink((operation) => {
    const ids = operation.variables['ids'] as string[];
    return options.gate === undefined
      ? of(answer(ids))
      : from(options.gate.then(() => answer(ids)));
  });
  const client = new ApolloClient({ cache, link });
  const everMissing: string[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );
  const view = renderHook(
    ({ lines }: { lines: CartLine[] }) => {
      const result = useCartProducts(lines);
      everMissing.push(...result.missing);
      return result;
    },
    { wrapper, initialProps: { lines: [] as CartLine[] } },
  );
  return { ...view, cache, server, everMissing };
}

afterEach(cleanup);

describe('useCartProducts: only a product the server no longer has is missing (D-28)', () => {
  it('never calls a cached product missing while lines are added', async () => {
    const { result, rerender, everMissing } = setUp({
      server: ['a', 'b', 'c'],
      cached: ['a', 'b', 'c'],
    });
    rerender({ lines: linesOf('a') });
    await waitFor(() => {
      expect(result.current.products.has('a')).toBe(true);
    });
    rerender({ lines: linesOf('a', 'b') });
    rerender({ lines: linesOf('a', 'b', 'c') });
    await waitFor(() => {
      expect(result.current.products.size).toBe(3);
    });
    expect(everMissing).toEqual([]);
  });

  it('never calls a product missing while the lookup is still out', async () => {
    let open = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const { result, rerender, everMissing } = setUp({
      server: ['a', 'b'],
      cached: ['a'],
      gate,
    });
    rerender({ lines: linesOf('a') });
    rerender({ lines: linesOf('a', 'b') }); // b is not cached: the slow lookup goes out
    await act(() => Promise.resolve());
    expect(result.current.missing).toEqual([]);
    open();
    await waitFor(() => {
      expect(result.current.products.has('b')).toBe(true);
    });
    expect(everMissing).toEqual([]);
  });

  it('reports a product the server answered without, and nothing else', async () => {
    const { result, rerender, everMissing } = setUp({ server: ['a'] });
    rerender({ lines: linesOf('a', 'deleted') });
    await waitFor(() => {
      expect(result.current.missing).toEqual(['deleted']);
    });
    expect(new Set(everMissing)).toEqual(new Set(['deleted']));
    rerender({ lines: linesOf('a') }); // the terminal removed its lines
    await waitFor(() => {
      expect(result.current.missing).toEqual([]);
    });
  });
});
