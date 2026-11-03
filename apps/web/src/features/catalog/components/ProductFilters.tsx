'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';

import { ToggleField } from '@/components/forms/ToggleField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

import { useCategoryOptions } from '../hooks/useCategoryOptions';

import type { ProductSort } from '@/graphql/__generated__/graphql';

/** `''` = all categories, `'none'` = Uncategorised, otherwise a category id. */
export interface ProductFilterState {
  search: string;
  category: string;
  sort: ProductSort;
  lowStockOnly: boolean;
  includeArchived: boolean;
}

const SORTS: readonly { value: ProductSort; label: string }[] = [
  { value: 'NAME_ASC', label: 'Name A–Z' },
  { value: 'NAME_DESC', label: 'Name Z–A' },
  { value: 'PRICE_ASC', label: 'Price low–high' },
  { value: 'PRICE_DESC', label: 'Price high–low' },
];

/**
 * Server-side product search and filters (FEATURES.md §3.3): search runs when submitted, so typing
 * sends no requests; the selects and toggles apply at once.
 */
export function ProductFilters({
  value,
  onChange,
}: {
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
}) {
  const [text, setText] = useState(value.search);
  const categories = useCategoryOptions();
  const set = (patch: Partial<ProductFilterState>) => {
    onChange({ ...value, ...patch });
  };
  return (
    <form
      className="mb-4 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        set({ search: text.trim() });
      }}
    >
      <Input
        className="max-w-xs"
        placeholder="Name, Urdu name or barcode"
        aria-label="Search products"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Button type="submit" variant="outline">
        <SearchIcon /> Search
      </Button>
      <NativeSelect
        className="w-48"
        aria-label="Category"
        value={value.category}
        onChange={(event) => {
          set({ category: event.target.value });
        }}
      >
        <option value="">All categories</option>
        <option value="none">Uncategorised</option>
        {categories.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        className="w-40"
        aria-label="Sort"
        value={value.sort}
        onChange={(event) => {
          set({ sort: event.target.value as ProductSort });
        }}
      >
        {SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <ToggleField
        label="Low stock only"
        checked={value.lowStockOnly}
        onChange={(lowStockOnly) => {
          set({ lowStockOnly });
        }}
      />
      <ToggleField
        label="Show archived"
        checked={value.includeArchived}
        onChange={(includeArchived) => {
          set({ includeArchived });
        }}
      />
    </form>
  );
}
