'use client';

import { useQuery } from '@apollo/client/react';

import { PageHeader } from '@/components/layout/PageHeader';
import { useCursorPages } from '@/hooks/useCursorPages';

import { LowStockProductsDocument } from '../graphql/inventory.documents';
import { useProductActions } from '../hooks/useProductActions';

import { ProductDialogs } from './ProductDialogs';
import { ProductList } from './ProductList';

import type { ReactNode } from 'react';

/**
 * Low stock (F-13, BR-02): active products at or below their threshold, emptiest first, in pages of
 * 50. The list and the sidebar badge refresh on `lowStock.countChanged`, never on a timer.
 */
/** `extraActions`: header actions from the route (the CSV and PDF export, F-13). */
export function LowStockScreen({ extraActions }: { extraActions?: ReactNode }) {
  const pages = useCursorPages();
  const actions = useProductActions();
  const { data, error } = useQuery(LowStockProductsDocument, { variables: { after: pages.after } });
  return (
    <>
      <PageHeader
        title="Low stock"
        description="Products at or below their alert level. Restock them from here."
        actions={extraActions}
      />
      <ProductList
        connection={data?.lowStockProducts}
        error={error}
        pages={pages}
        empty="Nothing is low on stock."
        onAction={actions.onAction}
      />
      <ProductDialogs
        open={actions.open}
        onClose={actions.close}
        archiveToggle={actions.archiveToggle}
        deletion={actions.deletion}
        defaultCategoryId={null}
      />
    </>
  );
}
