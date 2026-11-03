'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { cloneProductInputSchema, type CloneProductInput } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';
import { newIdempotencyKey } from '@/lib/ids/idempotency-key';

import { CloneProductDocument } from '../graphql/products.documents';

import type { CatalogProduct } from '../product';
import type { z } from 'zod';

type CloneForm = z.input<typeof cloneProductInputSchema>;

/**
 * Clone per barcode (F-09, D-19): each newly scanned barcode becomes a separate product with every
 * other attribute copied and its own stock (default 1). The dialog stays open for the next unit;
 * Cancel closes it.
 */
export function CloneProductDialog({
  product,
  onOpenChange,
}: {
  product: CatalogProduct;
  onOpenChange: (open: boolean) => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const [clone, { loading }] = useMutation(CloneProductDocument, { refetchQueries: ['Products'] });
  const fresh = (): CloneForm => ({
    idempotencyKey: newIdempotencyKey(),
    sourceProductId: product.id,
    barcode: '',
    initialStockPieces: 1,
  });
  const { register, handleSubmit, formState, setError, reset, setFocus } = useForm<
    CloneForm,
    unknown,
    CloneProductInput
  >({ resolver: zodResolver(cloneProductInputSchema), defaultValues: fresh() });

  const submit = handleSubmit(async (input) => {
    try {
      await clone({ variables: { input } });
      setAdded((previous) => [...previous, input.barcode]);
      toast.success(`Added ${product.name} with barcode ${input.barcode}.`);
      reset(fresh());
      setFocus('barcode');
    } catch (error) {
      applyFieldErrors(error, setError, ['barcode', 'initialStockPieces']);
    }
  });
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`Clone ${product.name}`}
      description="Scan or type the new unit's barcode. Price, unit, tax and threshold are copied."
      submitLabel="Add unit"
      busy={loading}
      onSubmit={submit}
    >
      <FormTextField
        name="barcode"
        label="New barcode"
        autoFocus
        autoComplete="off"
        register={register}
        error={formState.errors.barcode?.message}
      />
      <FormTextField
        name="initialStockPieces"
        label="Stock (pieces)"
        type="number"
        min={0}
        register={register}
        registerOptions={{ valueAsNumber: true }}
        error={formState.errors.initialStockPieces?.message}
      />
      {added.length > 0 && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Added {added.length}: {added.join(', ')}
        </p>
      )}
    </FormDialog>
  );
}
