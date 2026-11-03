'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { khataPaymentMethodSchema, optionalText, positiveMoneySchema } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormSelectField } from '@/components/forms/FormSelectField';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';
import { newIdempotencyKey } from '@/lib/ids/idempotency-key';

import { KHATA_PAYMENT_OPTIONS } from './khata-labels';

import type { PaymentMethod } from '@pos/contracts';

/** The shared khata entry fields, built from the `@pos/validation` atoms (rule 4). */
const entrySchema = z.object({
  amount: positiveMoneySchema,
  method: khataPaymentMethodSchema,
  note: optionalText(300, 'Note'),
});
type EntryForm = z.input<typeof entrySchema>;

export interface KhataEntryValues {
  idempotencyKey: string;
  amount: string;
  method: PaymentMethod;
  note: string | null;
}

/**
 * Amount (+ method for payments) + note for one khata entry. One idempotency key per opened
 * dialog, so a retried submit cannot post twice (ADR-015). Server field errors land on the fields.
 */
export function KhataEntryDialog({
  title,
  description,
  submitLabel,
  withMethod,
  noteLabel = 'Note (optional)',
  onSubmit,
  onOpenChange,
}: {
  title: string;
  description: string;
  submitLabel: string;
  withMethod: boolean;
  noteLabel?: string;
  /** Performs the mutation; rejects with the GraphQL error on failure. */
  onSubmit: (values: KhataEntryValues) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [key] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState, setError } = useForm<
    EntryForm,
    unknown,
    z.output<typeof entrySchema>
  >({
    resolver: zodResolver(entrySchema),
    defaultValues: { amount: '', method: 'CASH', note: '' },
  });
  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      await onSubmit({ ...values, idempotencyKey: key });
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors(error, setError, ['amount', 'method', 'note']);
    } finally {
      setBusy(false);
    }
  });
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      submitLabel={submitLabel}
      busy={busy}
      onSubmit={submit}
    >
      <FormTextField
        name="amount"
        label="Amount (Rs)"
        inputMode="decimal"
        autoFocus
        register={register}
        error={formState.errors.amount?.message}
      />
      {withMethod && (
        <FormSelectField
          name="method"
          label="Payment method"
          register={register}
          options={KHATA_PAYMENT_OPTIONS}
          error={formState.errors.method?.message}
        />
      )}
      <FormTextField
        name="note"
        label={noteLabel}
        register={register}
        error={formState.errors.note?.message}
      />
    </FormDialog>
  );
}
