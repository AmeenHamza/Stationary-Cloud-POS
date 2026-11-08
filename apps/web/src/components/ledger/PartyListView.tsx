'use client';

import { SearchIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';

import { CursorPager, type PagedConnection } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { DeleteConfirm } from '@/components/feedback/DeleteConfirm';
import { ToggleField } from '@/components/forms/ToggleField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { PartyTable } from './PartyTable';

import type { BalanceLabels, PartySummary } from './khata-labels';
import type { PartyDeletion } from './usePartyDeletion';
import type { CursorPages } from '@/hooks/useCursorPages';

export interface PartyListFilter {
  search: string;
  withBalanceOnly: boolean;
  includeArchived: boolean;
}

/** Server-side search (on submit) and the list toggles. */
function PartySearchBar({
  noun,
  filter,
  onFilter,
}: {
  noun: string;
  filter: PartyListFilter;
  onFilter: (next: PartyListFilter) => void;
}) {
  const [text, setText] = useState(filter.search);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onFilter({ ...filter, search: text.trim() });
      }}
    >
      <Input
        className="max-w-xs"
        placeholder="Name or phone"
        aria-label={`Search ${noun}s`}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Button type="submit" variant="outline">
        <SearchIcon /> Search
      </Button>
      <ToggleField
        label="With balance only"
        checked={filter.withBalanceOnly}
        onChange={(withBalanceOnly) => {
          onFilter({ ...filter, withBalanceOnly });
        }}
      />
      <ToggleField
        label="Show archived"
        checked={filter.includeArchived}
        onChange={(includeArchived) => {
          onFilter({ ...filter, includeArchived });
        }}
      />
    </form>
  );
}

/**
 * A searchable, keyset-paged party list (FEATURES.md §3.9–3.10): the search runs on the server when
 * submitted; the toggles apply at once. Used by the admin pages and the terminal modals.
 */
export function PartyListView({
  noun,
  connection,
  error,
  pages,
  filter,
  onFilter,
  labels,
  detailHeading,
  onOpen,
  deletion,
}: {
  noun: string;
  connection: (PagedConnection & { nodes: readonly PartySummary[] }) | undefined;
  error: unknown;
  pages: CursorPages;
  filter: PartyListFilter;
  onFilter: (next: PartyListFilter) => void;
  labels: BalanceLabels;
  detailHeading?: string;
  onOpen: (party: PartySummary) => void;
  deletion?: PartyDeletion;
}) {
  return (
    <div className="grid gap-4">
      <PartySearchBar noun={noun} filter={filter} onFilter={onFilter} />
      {error !== undefined && <p className="text-destructive">{userMessageOf(error)}</p>}
      {connection === undefined && error === undefined && (
        <p className="text-muted-foreground">Loading {noun}s…</p>
      )}
      {connection?.nodes.length === 0 && (
        <EmptyState icon={UsersIcon}>No {noun}s match these filters.</EmptyState>
      )}
      {connection !== undefined && connection.nodes.length > 0 && (
        <div>
          <div className="rounded-xl border bg-card">
            <PartyTable
              parties={connection.nodes}
              labels={labels}
              onOpen={onOpen}
              {...(detailHeading === undefined ? {} : { detailHeading })}
              {...(deletion === undefined ? {} : { onDelete: deletion.control.ask })}
            />
          </div>
          <CursorPager pages={pages} connection={connection} />
        </div>
      )}
      {deletion !== undefined && (
        <DeleteConfirm control={deletion.control} description={deletion.description} />
      )}
    </div>
  );
}
