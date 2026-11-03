'use client';

import { PackageIcon } from 'lucide-react';

import { CursorPager } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { ProductTable } from './ProductTable';

import type { CatalogProduct } from '../product';
import type { ProductAction } from './ProductRowActions';
import type { CursorPages } from '@/hooks/useCursorPages';

interface ProductPage {
  nodes: readonly CatalogProduct[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number | null;
}

/** Loading, error, empty and table states for one page of products, with the pager. */
export function ProductList({
  connection,
  error,
  pages,
  empty,
  onAction,
}: {
  connection: ProductPage | undefined;
  error: unknown;
  pages: CursorPages;
  empty: string;
  onAction: (action: ProductAction, product: CatalogProduct) => void;
}) {
  if (error !== undefined) {
    return <p className="text-destructive">{userMessageOf(error)}</p>;
  }
  if (connection === undefined) {
    return <p className="text-muted-foreground">Loading products…</p>;
  }
  if (connection.nodes.length === 0) {
    return <EmptyState icon={PackageIcon}>{empty}</EmptyState>;
  }
  return (
    <>
      <div className="rounded-xl border bg-card">
        <ProductTable products={connection.nodes} onAction={onAction} />
      </div>
      <CursorPager pages={pages} connection={connection} />
    </>
  );
}
