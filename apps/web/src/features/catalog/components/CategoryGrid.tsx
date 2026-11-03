'use client';

import { TagsIcon } from 'lucide-react';

import { CursorPager } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { CategoryCard, type CategoryCardActions } from './CategoryCard';

import type { CategoriesQuery } from '@/graphql/__generated__/graphql';
import type { CursorPages } from '@/hooks/useCursorPages';

/** Loading, error, empty and card states for one page of categories, with the pager. */
export function CategoryGrid({
  connection,
  error,
  pages,
  actions,
}: {
  connection: CategoriesQuery['categories'] | undefined;
  error: unknown;
  pages: CursorPages;
  actions: CategoryCardActions;
}) {
  if (error !== undefined) {
    return <p className="text-destructive">{userMessageOf(error)}</p>;
  }
  if (connection === undefined) {
    return <p className="text-muted-foreground">Loading categories…</p>;
  }
  if (connection.nodes.length === 0) {
    return <EmptyState icon={TagsIcon}>No categories yet.</EmptyState>;
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {connection.nodes.map((category) => (
          <CategoryCard key={category.id} category={category} actions={actions} />
        ))}
      </div>
      <CursorPager pages={pages} connection={connection} />
    </>
  );
}
