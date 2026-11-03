import { Suspense } from 'react';

import { ProductsRoute } from './ProductsRoute';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Products' };

/** Products (F-08–F-10, F-32). The search params are read on the client, so the shell stays static. */
export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsRoute />
    </Suspense>
  );
}
