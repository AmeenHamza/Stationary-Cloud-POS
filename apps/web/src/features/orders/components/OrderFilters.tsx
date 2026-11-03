'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';

import { ToggleField } from '@/components/forms/ToggleField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

import { ORDER_STATUS_LABEL } from '../order-labels';

import type { OrderStatus } from '@pos/contracts';

export interface OrderFilterState {
  billNumber: string;
  status: OrderStatus | '';
  includeArchived: boolean;
}

export const NO_ORDER_FILTER: OrderFilterState = {
  billNumber: '',
  status: '',
  includeArchived: false,
};

/** Search by order number (a prefix such as "ORD-20261028"), status, and the archive (F-35). */
export function OrderFilters({
  value,
  onChange,
}: {
  value: OrderFilterState;
  onChange: (next: OrderFilterState) => void;
}) {
  const [text, setText] = useState(value.billNumber);
  return (
    <form
      className="mb-4 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...value, billNumber: text.trim() });
      }}
    >
      <Input
        className="max-w-xs"
        placeholder="Search by order number"
        aria-label="Search by order number"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Button type="submit" variant="outline">
        <SearchIcon /> Search
      </Button>
      <NativeSelect
        className="w-44"
        aria-label="Status"
        value={value.status}
        onChange={(event) => {
          onChange({ ...value, status: event.target.value as OrderStatus | '' });
        }}
      >
        <option value="">All statuses</option>
        {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABEL[status]}
          </option>
        ))}
      </NativeSelect>
      <ToggleField
        label="Older than 90 days too"
        checked={value.includeArchived}
        onChange={(includeArchived) => {
          onChange({ ...value, includeArchived });
        }}
      />
    </form>
  );
}
