'use client';

import { Skeleton } from '@/components/ui/skeleton';

import { ProductTile } from './ProductTile';

import type { SaleProductFieldsFragment as SaleProduct } from '@/graphql/__generated__/graphql';

const LOADING_CARDS = 8;

/** The card view of the terminal's products (F-18): up to 4 across on a wide screen. */
export function ProductCards({
  products,
  loading,
}: {
  products: readonly SaleProduct[];
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductTile key={product.id} product={product} />
      ))}
      {loading &&
        Array.from({ length: LOADING_CARDS }, (_, index) => (
          <div
            key={`loading-${String(index)}`}
            className="surface-card grid gap-3 rounded-xl border p-3"
            aria-hidden
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
    </div>
  );
}
