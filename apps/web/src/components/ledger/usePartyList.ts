'use client';

import { useState } from 'react';

import { useCursorPages } from '@/hooks/useCursorPages';

import type { PartyListFilter } from './PartyListView';

const EMPTY: PartyListFilter = { search: '', withBalanceOnly: false, includeArchived: false };

/**
 * State of one party list: filter and keyset pages. `variables` feeds the feature's query;
 * `view` spreads into `<PartyListView>`. A filter change returns to the first page.
 */
export function usePartyList() {
  const pages = useCursorPages();
  const [filter, setFilter] = useState<PartyListFilter>(EMPTY);
  return {
    variables: {
      after: pages.after,
      filter: {
        ...(filter.search === '' ? {} : { search: filter.search }),
        ...(filter.withBalanceOnly ? { withBalanceOnly: true } : {}),
        ...(filter.includeArchived ? { includeArchived: true } : {}),
      },
    },
    view: {
      pages,
      filter,
      onFilter: (next: PartyListFilter) => {
        setFilter(next);
        pages.reset();
      },
    },
  };
}

/** State of one ledger: keyset pages and the 90-day toggle (F-35). */
export function useLedgerPages() {
  const pages = useCursorPages();
  const [includeArchived, setIncludeArchived] = useState(false);
  return {
    pages,
    includeArchived,
    onIncludeArchived: (value: boolean) => {
      setIncludeArchived(value);
      pages.reset();
    },
  };
}
