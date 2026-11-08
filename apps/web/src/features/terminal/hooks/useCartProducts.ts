'use client';

import { skipToken, useQuery } from '@apollo/client/react';
import { useMemo } from 'react';

import { MAX_IDS_PER_LOOKUP } from '@pos/contracts';

import { CartProductsDocument } from '../graphql/terminal.documents';

import type { CartLine } from '../state/cart.types';
import type { SaleProductFieldsFragment as SaleProduct } from '@/graphql/__generated__/graphql';

/**
 * The cart's products from the live cache (SYSTEM_DESIGN.md §3.1). A cart has at most 100 distinct
 * products (Q34), so two lookups of ≤ 50 ids cover it; both are answered from the cache unless a
 * product is missing there (e.g. a cart restored after a reload). `missing` lists the ids the server
 * answered without: those products were deleted (D-28).
 */
export function useCartProducts(lines: readonly CartLine[]): {
  products: ReadonlyMap<string, SaleProduct>;
  missing: readonly string[];
} {
  const ids = useMemo(() => [...new Set(lines.map((line) => line.productId))], [lines]);
  const first = ids.slice(0, MAX_IDS_PER_LOOKUP);
  const rest = ids.slice(MAX_IDS_PER_LOOKUP);
  const a = useQuery(
    CartProductsDocument,
    first.length === 0 ? skipToken : { variables: { ids: first } },
  );
  const b = useQuery(
    CartProductsDocument,
    rest.length === 0 ? skipToken : { variables: { ids: rest } },
  );
  const answeredA = a.data?.productsByIds;
  const answeredB = b.data?.productsByIds;
  const nodesA = answeredA ?? a.previousData?.productsByIds;
  const nodesB = answeredB ?? b.previousData?.productsByIds;
  const products = useMemo(
    () => new Map([...(nodesA ?? []), ...(nodesB ?? [])].map((product) => [product.id, product])),
    [nodesA, nodesB],
  );
  const missing = useMemo(() => {
    const found = new Set([...(answeredA ?? []), ...(answeredB ?? [])].map((p) => p.id));
    const asked = [
      ...(answeredA === undefined ? [] : ids.slice(0, MAX_IDS_PER_LOOKUP)),
      ...(answeredB === undefined ? [] : ids.slice(MAX_IDS_PER_LOOKUP)),
    ];
    return asked.filter((id) => !found.has(id));
  }, [ids, answeredA, answeredB]);
  return { products, missing };
}
