'use client';

import { useQuery } from '@apollo/client/react';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { DeleteConfirm } from '@/components/feedback/DeleteConfirm';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useCursorPages } from '@/hooks/useCursorPages';

import { CategoriesDocument } from '../graphql/categories.documents';
import { useDeleteCategory } from '../hooks/useDeleteCategory';

import { CategoryFormDialog } from './CategoryFormDialog';
import { CategoryGrid } from './CategoryGrid';
import { ProductFormDialog } from './ProductFormDialog';

import type { CategoryFieldsFragment } from '@/graphql/__generated__/graphql';

type Dialog =
  | { kind: 'category'; category: CategoryFieldsFragment | null }
  | { kind: 'product'; categoryId: string }
  | null;

/** Categories grid (F-12): counts update live; "View products" opens the filtered product list. */
export function CategoriesScreen() {
  const pages = useCursorPages();
  const [dialog, setDialog] = useState<Dialog>(null);
  const deletion = useDeleteCategory();
  const { data, error } = useQuery(CategoriesDocument, { variables: { after: pages.after } });
  const close = (open: boolean): void => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Groups for the catalogue and the terminal's category chips."
        actions={
          <Button
            variant="brand"
            onClick={() => {
              setDialog({ kind: 'category', category: null });
            }}
          >
            <PlusIcon /> Add category
          </Button>
        }
      />
      <CategoryGrid
        connection={data?.categories}
        error={error}
        pages={pages}
        actions={{
          onAddProduct: (category) => {
            setDialog({ kind: 'product', categoryId: category.id });
          },
          onEdit: (category) => {
            setDialog({ kind: 'category', category });
          },
          onDelete: deletion.control.ask,
        }}
      />
      {dialog?.kind === 'category' && (
        <CategoryFormDialog category={dialog.category} onOpenChange={close} />
      )}
      {dialog?.kind === 'product' && (
        <ProductFormDialog
          productId={null}
          defaultCategoryId={dialog.categoryId}
          onOpenChange={close}
        />
      )}
      <DeleteConfirm control={deletion.control} description={deletion.description} />
    </>
  );
}
