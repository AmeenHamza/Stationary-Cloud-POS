'use client';

import { useQuery } from '@apollo/client/react';
import { PackageSearchIcon } from 'lucide-react';
import { useState } from 'react';

import { CursorPager } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { NativeSelect } from '@/components/ui/native-select';
import { useCursorPages } from '@/hooks/useCursorPages';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { TerminalProductsDocument } from '../graphql/terminal.documents';
import { useProductView, type ProductView } from '../hooks/useProductView';

import { CategoryChips } from './CategoryChips';
import { ProductCards } from './ProductCards';
import { ProductRows } from './ProductRows';
import { ProductSearchBar } from './ProductSearchBar';

import type { ProductSort } from '@/graphql/__generated__/graphql';

const SORTS: readonly { value: ProductSort; label: string }[] = [
  { value: 'NAME_ASC', label: 'Name (A-Z)' },
  { value: 'NAME_DESC', label: 'Name (Z-A)' },
  { value: 'PRICE_ASC', label: 'Price (low-high)' },
  { value: 'PRICE_DESC', label: 'Price (high-low)' },
];

const VIEWS: readonly { value: ProductView; label: string }[] = [
  { value: 'CARD', label: 'Card view' },
  { value: 'LIST', label: 'List view' },
];

interface PickerFilter {
  search: string;
  categoryId: string;
  sort: ProductSort;
}

function OptionSelect<T extends string>({
  label,
  className,
  options,
  value,
  onChange,
}: {
  label: string;
  className: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <NativeSelect
      className={className}
      aria-label={label}
      value={value}
      onChange={(event) => {
        onChange(event.target.value as T);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}

/**
 * Product selection (F-18): server search, category chips and sort over keyset pages of 50; the
 * terminal never downloads the catalogue. Shown as cards or as a list (F-38). Products stay current
 * through `stock.changed` and `product.changed` patches.
 */
export function ProductPicker() {
  const pages = useCursorPages();
  const { view, choose } = useProductView();
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
  const shown = { products: connection?.nodes ?? [], loading: connection === undefined && loading };
  return (
    <section aria-label="Products" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProductSearchBar
          onSearch={(search) => {
            change({ search });
          }}
        />
        <OptionSelect
          label="Sort"
          className="w-44"
          options={SORTS}
          value={filter.sort}
          onChange={(sort) => {
            change({ sort });
          }}
        />
        <OptionSelect
          label="View"
          className="w-36"
          options={VIEWS}
          value={view}
          onChange={choose}
        />
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
      {connection?.nodes.length === 0 ? (
        <EmptyState icon={PackageSearchIcon}>
          {filter.search === '' ? 'No products here.' : `Nothing matches “${filter.search}”.`}
        </EmptyState>
      ) : view === 'LIST' ? (
        <ProductRows {...shown} />
      ) : (
        <ProductCards {...shown} />
      )}
      {connection !== undefined && <CursorPager pages={pages} connection={connection} />}
    </section>
  );
}
