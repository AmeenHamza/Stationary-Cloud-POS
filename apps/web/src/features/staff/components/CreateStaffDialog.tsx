'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createStaffUserInputSchema, type CreateStaffUserInput } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormSelectField } from '@/components/forms/FormSelectField';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import { CreateStaffUserDocument } from '../graphql/staff.documents';

import { ROLE_OPTIONS } from './role-options';

import type { z } from 'zod';

type CreateForm = z.input<typeof createStaffUserInputSchema>;
const EMPTY: CreateForm = { username: '', fullName: '', role: 'CASHIER', password: '' };

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Admin-created staff account (F-31). */
export function CreateStaffDialog({ open, onOpenChange }: DialogProps) {
  const [create, { loading }] = useMutation(CreateStaffUserDocument, {
    refetchQueries: ['StaffUsers'],
  });
  const { register, handleSubmit, formState, setError, reset } = useForm<
    CreateForm,
    unknown,
    CreateStaffUserInput
  >({
    resolver: zodResolver(createStaffUserInputSchema),
    defaultValues: EMPTY,
  });
  const close = (next: boolean): void => {
    if (!next) reset(EMPTY);
    onOpenChange(next);
  };
  const submit = handleSubmit(async (input) => {
    try {
      await create({ variables: { input } });
      toast.success(`${input.fullName} can now sign in as ${input.username}.`);
      close(false);
    } catch (error) {
      applyFieldErrors(error, setError, ['username', 'fullName', 'role', 'password']);
    }
  });
  const errors = formState.errors;
  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title="Add staff"
      submitLabel="Create account"
      busy={loading}
      onSubmit={submit}
      description="Share the username and password with the person in person. They can change the password later."
    >
      <FormTextField
        name="fullName"
        label="Full name"
        register={register}
        error={errors.fullName?.message}
        autoComplete="off"
      />
      <FormTextField
        name="username"
        label="Username"
        register={register}
        error={errors.username?.message}
        autoComplete="off"
        autoCapitalize="none"
      />
      <FormSelectField
        name="role"
        label="Role"
        register={register}
        options={ROLE_OPTIONS}
        error={errors.role?.message}
      />
      <FormTextField
        name="password"
        label="Password"
        type="password"
        register={register}
        error={errors.password?.message}
        autoComplete="new-password"
      />
    </FormDialog>
  );
}
