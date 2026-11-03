'use client';

import { useQuery } from '@apollo/client/react';
import { PackageSearchIcon } from 'lucide-react';
import { useState } from 'react';

import { CursorPager } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCursorPages } from '@/hooks/useCursorPages';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { TerminalProductsDocument } from '../graphql/terminal.documents';

import { CategoryChips } from './CategoryChips';
import { ProductSearchBar } from './ProductSearchBar';
import { ProductTile } from './ProductTile';

import type { ProductSort } from '@/graphql/__generated__/graphql';

const SORTS: readonly { value: ProductSort; label: string }[] = [
  { value: 'NAME_ASC', label: 'Name (A-Z)' },
  { value: 'NAME_DESC', label: 'Name (Z-A)' },
  { value: 'PRICE_ASC', label: 'Price (low-high)' },
  { value: 'PRICE_DESC', label: 'Price (high-low)' },
];

interface PickerFilter {
  search: string;
  categoryId: string;
  sort: ProductSort;
}

/**
 * Product selection (F-18): server search, category chips and sort over keyset pages of 50; the
 * terminal never downloads the catalogue. Tiles stay current through `stock.changed` and
 * `product.changed` patches.
 */
export function ProductPicker() {
  const pages = useCursorPages();
  const [filter, setFilter] = useState<PickerFilter>({
    search: '',
    categoryId: '',
    sort: 'NAME_ASC',
  });
  const change = (patch: Partial<PickerFilter>) => {
    setFilter((current) => ({ ...current, ...patch }));
    pages.reset();
  };
  const { data, previousData, error, loading } = useQuery(TerminalProductsDocument, {
    variables: {
      after: pages.after,
      sort: filter.sort,
      filter: {
        ...(filter.search === '' ? {} : { search: filter.search }),
        ...(filter.categoryId === '' ? {} : { categoryId: filter.categoryId }),
      },
    },
  });
  const connection = (data ?? previousData)?.products;
  return (
    <section aria-label="Products" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProductSearchBar
          onSearch={(search) => {
            change({ search });
          }}
        />
        <NativeSelect
          className="w-44"
          aria-label="Sort"
          value={filter.sort}
          onChange={(event) => {
            change({ sort: event.target.value as ProductSort });
          }}
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <CategoryChips
        value={filter.categoryId}
        onChange={(categoryId) => {
          change({ categoryId });
        }}
      />
      {error !== undefined && connection === undefined && (
        <p className="text-destructive">{userMessageOf(error)}</p>
      )}
      {connection?.nodes.length === 0 && (
        <EmptyState icon={PackageSearchIcon}>
          {filter.search === '' ? 'No products here.' : `Nothing matches “${filter.search}”.`}
        </EmptyState>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {connection?.nodes.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
        {connection === undefined && loading &&
          Array.from({ length: 8 }, (_, index) => (
            <div key={`loading-${String(index)}`} className="surface-card grid gap-3 rounded-xl border p-3" aria-hidden>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
      </div>
      {connection !== undefined && <CursorPager pages={pages} connection={connection} />}
    </section>
  );
}
