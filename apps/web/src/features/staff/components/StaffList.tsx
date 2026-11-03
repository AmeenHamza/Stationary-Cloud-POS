'use client';

import { UsersIcon } from 'lucide-react';

import { CursorPager } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { StaffTable, type StaffActions } from './StaffTable';

import type { StaffMember } from '../staff-user';
import type { CursorPages } from '@/hooks/useCursorPages';

interface StaffPage {
  nodes: StaffMember[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number | null;
}

/** Loading, error, empty and table states for one page of staff, with the pager. */
export function StaffList({
  connection,
  error,
  pages,
  actions,
}: {
  connection: StaffPage | undefined;
  error: unknown;
  pages: CursorPages;
  actions: StaffActions;
}) {
  if (error !== undefined) {
    return <p className="text-destructive">{userMessageOf(error)}</p>;
  }
  if (connection === undefined) {
    return <p className="text-muted-foreground">Loading staff…</p>;
  }
  if (connection.nodes.length === 0) {
    return <EmptyState icon={UsersIcon}>No staff match these filters.</EmptyState>;
  }
  return (
    <>
      <StaffTable members={connection.nodes} actions={actions} />
      <CursorPager pages={pages} connection={connection} />
    </>
  );
}
