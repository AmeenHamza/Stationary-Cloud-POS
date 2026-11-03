'use client';

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { CategoryFieldsFragment } from '@/graphql/__generated__/graphql';

export interface CategoryCardActions {
  onAddProduct: (category: CategoryFieldsFragment) => void;
  onEdit: (category: CategoryFieldsFragment) => void;
  onDelete: (category: CategoryFieldsFragment) => void;
}

/** One category in the grid (FEATURES.md §3.4): count, View products, Add product, Edit, Delete. */
export function CategoryCard({
  category,
  actions,
}: {
  category: CategoryFieldsFragment;
  actions: CategoryCardActions;
}) {
  const count = category.productCount;
  return (
    <Card data-category-id={category.id}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {category.iconEmoji !== null && <span aria-hidden>{category.iconEmoji}</span>}
          {category.name}
        </CardTitle>
        <CardDescription>
          {count} product{count === 1 ? '' : 's'}
          {category.description !== null && ` · ${category.description}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/products?category=${category.id}`}>View products</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            actions.onAddProduct(category);
          }}
        >
          <PlusIcon /> Add product
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Edit ${category.name}`}
          onClick={() => {
            actions.onEdit(category);
          }}
        >
          <PencilIcon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete ${category.name}`}
          onClick={() => {
            actions.onDelete(category);
          }}
        >
          <Trash2Icon />
        </Button>
      </CardContent>
    </Card>
  );
}
