'use client';

import { useSearchParams } from 'next/navigation';

import { ProductsScreen } from '@/features/catalog';
import { ProductTransferActions } from '@/features/catalog-io';

/** Reads `?category=<id>` (a category's "View products") into the screen's initial filter. */
export function ProductsRoute() {
  const category = useSearchParams().get('category') ?? '';
  return (
    <ProductsScreen
      key={category}
      initialCategory={category}
      extraActions={<ProductTransferActions />}
    />
  );
}
