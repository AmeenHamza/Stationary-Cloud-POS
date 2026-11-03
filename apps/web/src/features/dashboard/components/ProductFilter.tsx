'use client';

import { useLazyQuery } from '@apollo/client/react';
import { SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

import { DashboardProductSearchDocument } from '../graphql/dashboard.documents';

export interface PickedProduct {
  id: string;
  name: string;
}

/** "Filter by product" for the weekly chart (FEATURES.md §3.2): search on the server, pick one. */
export function ProductFilter({
  value,
  onChange,
}: {
  value: PickedProduct | null;
  onChange: (product: PickedProduct | null) => void;
}) {
  const [text, setText] = useState('');
  const [search, { data }] = useLazyQuery(DashboardProductSearchDocument);
  const matches = data?.products.nodes ?? [];
  if (value !== null) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          onChange(null);
        }}
      >
        {value.name} <XIcon aria-label="Show all products" />
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim().length >= 2) void search({ variables: { search: text.trim() } });
      }}
    >
      <Input
        className="h-8 w-44"
        placeholder="Filter by product"
        aria-label="Filter by product"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Button type="submit" size="sm" variant="outline" aria-label="Find product">
        <SearchIcon />
      </Button>
      {matches.length > 0 && (
        <NativeSelect
          className="h-8 w-48"
          aria-label="Matching products"
          value=""
          onChange={(event) => {
            const picked = matches.find((product) => product.id === event.target.value);
            if (picked !== undefined) onChange(picked);
          }}
        >
          <option value="">Pick a product…</option>
          {matches.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </form>
  );
}
