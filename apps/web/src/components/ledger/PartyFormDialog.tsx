'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { createVendorInputSchema, type CreateVendorInput } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import type { z } from 'zod';

type PartyForm = z.input<typeof createVendorInputSchema>;

export interface PartyFormInitial {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  productsSupplied?: string | null;
}

function formDefaults(initial: PartyFormInitial | null): PartyForm {
  return {
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    productsSupplied: initial?.productsSupplied ?? '',
  };
}

const FIELDS = ['name', 'phone', 'email', 'address', 'productsSupplied'] as const;

/**
 * Add or edit a customer or vendor (FEATURES.md §3.9 `#19`, §3.10 `#23`). The vendor schema is the
 * superset; customers simply never show or send "Products supplied".
 */
export function PartyFormDialog({
  title,
  submitLabel,
  initial,
  withProducts,
  onSubmit,
  onOpenChange,
}: {
  title: string;
  submitLabel: string;
  initial: PartyFormInitial | null;
  withProducts: boolean;
  onSubmit: (values: CreateVendorInput) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState, setError } = useForm<
    PartyForm,
    unknown,
    CreateVendorInput
  >({
    resolver: zodResolver(createVendorInputSchema),
    defaultValues: formDefaults(initial),
  });
  const errors = formState.errors;
  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors(error, setError, FIELDS);
    } finally {
      setBusy(false);
    }
  });
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={title}
      submitLabel={submitLabel}
      busy={busy}
      onSubmit={submit}
    >
      <FormTextField name="name" label="Name" register={register} error={errors.name?.message} />
      <FormTextField
        name="phone"
        label="Phone (optional)"
        inputMode="tel"
        register={register}
        error={errors.phone?.message}
      />
      <FormTextField
        name="email"
        label="Email (optional)"
        type="email"
        register={register}
        error={errors.email?.message}
      />
      <FormTextField
        name="address"
        label="Address (optional)"
        register={register}
        error={errors.address?.message}
      />
      {withProducts && (
        <FormTextField
          name="productsSupplied"
          label="Products supplied (optional)"
          register={register}
          error={errors.productsSupplied?.message}
        />
      )}
    </FormDialog>
  );
}
