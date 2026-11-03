'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

import type { UserStatus } from '@pos/contracts';

export type StatusFilter = UserStatus | 'ALL';

/**
 * Search runs on the server when submitted (Enter or the button), so typing sends no requests;
 * the status filter applies at once.
 */
export function StaffFilters({
  status,
  onSearch,
  onStatusChange,
}: {
  status: StatusFilter;
  onSearch: (search: string) => void;
  onStatusChange: (status: StatusFilter) => void;
}) {
  const [text, setText] = useState('');
  return (
    <form
      className="mb-4 flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(text.trim());
      }}
    >
      <Input
        className="max-w-sm"
        placeholder="Search by name or username"
        aria-label="Search staff"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Button type="submit" variant="outline">
        <SearchIcon /> Search
      </Button>
      <NativeSelect
        className="w-40"
        aria-label="Status"
        value={status}
        onChange={(event) => {
          onStatusChange(event.target.value as StatusFilter);
        }}
      >
        <option value="ALL">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="DISABLED">Disabled</option>
      </NativeSelect>
    </form>
  );
}
