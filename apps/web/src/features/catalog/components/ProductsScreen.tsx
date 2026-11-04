'use client';

import { useQuery } from '@apollo/client/react';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { formatRs } from '@pos/domain';

import { PageHeader } from '@/components/layout/PageHeader';
import { RevealKpiCard } from '@/components/metrics/RevealKpiCard';
import { Button } from '@/components/ui/button';
import { useCursorPages } from '@/hooks/useCursorPages';

import { ProductInventoryKpisDocument, ProductsDocument } from '../graphql/products.documents';
import { useProductActions } from '../hooks/useProductActions';

import { ProductDialogs } from './ProductDialogs';
import { ProductFilters, type ProductFilterState } from './ProductFilters';
import { ProductList } from './ProductList';

import type { ProductFilter } from '@/graphql/__generated__/graphql';
import type { ReactNode } from 'react';

function toFilter(state: ProductFilterState): ProductFilter {
  return {
    ...(state.search === '' ? {} : { search: state.search }),
    ...(state.category === '' || state.category === 'none' ? {} : { categoryId: state.category }),
    ...(state.category === 'none' ? { uncategorised: true } : {}),
    ...(state.lowStockOnly ? { lowStockOnly: true } : {}),
    ...(state.includeArchived ? { includeArchived: true } : {}),
  };
}

/**
 * Products (F-08–F-10, F-32): server-side search, category filter (a category's "View products"
 * opens this screen filtered), sort and keyset pages of 50. Stock and prices patch live.
 */
export function ProductsScreen({
  initialCategory = '',
  extraActions,
}: {
  initialCategory?: string;
  /** Header actions another feature adds through the route (import and export, F-11). */
  extraActions?: ReactNode;
}) {
  const pages = useCursorPages();
  const actions = useProductActions();
  const [filters, setFilters] = useState<ProductFilterState>({
    search: '',
    category: initialCategory,
    sort: 'NAME_ASC',
    lowStockOnly: false,
    includeArchived: false,
  });
  const { data, error } = useQuery(ProductsDocument, {
    variables: { after: pages.after, filter: toFilter(filters), sort: filters.sort },
  });
  const { data: kpis } = useQuery(ProductInventoryKpisDocument);
  const categoryId =
    filters.category === '' || filters.category === 'none' ? null : filters.category;

  return (
    <>
      <PageHeader
        title="Products"
        description="Catalogue, prices and stock. Changes reach every counter at once."
        actions={
          <>
            {extraActions}
            <Button variant="brand" onClick={actions.create}>
              <PlusIcon /> Add product
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <RevealKpiCard
          label="Inventory cost value"
          value={formatRs(kpis?.dashboard.inventory.costValue ?? '0')}
        />
        <RevealKpiCard
          label="Inventory selling value"
          value={formatRs(kpis?.dashboard.inventory.sellingValue ?? '0')}
        />
      </div>
      <ProductFilters
        value={filters}
        onChange={(next) => {
          setFilters(next);
          pages.reset();
        }}
      />
      <ProductList
        connection={data?.products}
        error={error}
        pages={pages}
        empty="No products match these filters."
        onAction={actions.onAction}
      />
      <ProductDialogs
        open={actions.open}
        onClose={actions.close}
        archiveToggle={actions.archiveToggle}
        defaultCategoryId={categoryId}
      />
    </>
  );
}
