'use client';

import { useQuery } from '@apollo/client/react';
import { useState } from 'react';

import { FormDialog } from '@/components/forms/FormDialog';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { ProductForEditDocument } from '../graphql/products.documents';
import { useProductForm, type EditableProduct } from '../hooks/useProductForm';

import { ProductFormFields } from './ProductFormFields';

function ProductFormBody({
  editing: loaded,
  defaultCategoryId,
  onOpenChange,
}: {
  editing: EditableProduct | null;
  defaultCategoryId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  // The version read when the form opened is the one saved against: if someone else changes the
  // product meanwhile (a live update), saving fails with CONFLICT instead of overwriting them.
  const [editing] = useState(loaded);
  const { form, submit, busy } = useProductForm(editing, defaultCategoryId, () => {
    onOpenChange(false);
  });
  return (
    <FormDialog
      open
      wide
      onOpenChange={onOpenChange}
      title={editing === null ? 'Add product' : `Edit ${editing.name}`}
      description={
        editing === null
          ? 'Prices are per piece; a box price applies when selling whole boxes.'
          : 'Stock is not edited here: use Restock or Adjust stock.'
      }
      submitLabel={editing === null ? 'Add product' : 'Save'}
      busy={busy}
      onSubmit={submit}
    >
      <ProductFormFields
        register={form.register}
        errors={form.formState.errors}
        isNew={editing === null}
      />
    </FormDialog>
  );
}

/** Loads the product with its cost price (admins only) before showing the edit form. */
function EditProductDialog({
  productId,
  onOpenChange,
}: {
  productId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, error } = useQuery(ProductForEditDocument, { variables: { id: productId } });
  const product = data?.product;
  if (product == null) {
    return error === undefined ? null : <p className="text-destructive">{userMessageOf(error)}</p>;
  }
  return (
    <ProductFormBody
      key={product.id}
      editing={product}
      defaultCategoryId={null}
      onOpenChange={onOpenChange}
    />
  );
}

/** Add or edit a product (F-08). `productId` null means a new product. */
export function ProductFormDialog({
  productId,
  defaultCategoryId,
  onOpenChange,
}: {
  productId: string | null;
  defaultCategoryId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return productId === null ? (
    <ProductFormBody
      editing={null}
      defaultCategoryId={defaultCategoryId}
      onOpenChange={onOpenChange}
    />
  ) : (
    <EditProductDialog productId={productId} onOpenChange={onOpenChange} />
  );
}
