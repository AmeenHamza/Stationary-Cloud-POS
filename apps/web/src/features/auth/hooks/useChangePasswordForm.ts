'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { changePasswordFormSchema, type ChangePasswordForm } from '@pos/validation';

import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import { ChangePasswordDocument } from '../graphql/auth.documents';

import type { z } from 'zod';

type FormInput = z.input<typeof changePasswordFormSchema>;
const EMPTY: FormInput = { currentPassword: '', newPassword: '', confirmNewPassword: '' };

/** Form state and submission for F-03; server field errors land on the matching inputs. */
export function useChangePasswordForm(onDone: () => void) {
  const [changePassword, { loading }] = useMutation(ChangePasswordDocument);
  const form = useForm<FormInput, unknown, ChangePasswordForm>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: EMPTY,
  });

  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword({ variables: { input: { currentPassword, newPassword } } });
      toast.success('Password changed. Other devices have been signed out.');
      form.reset(EMPTY);
      onDone();
    } catch (error) {
      applyFieldErrors(error, form.setError, ['currentPassword', 'newPassword']);
    }
  });

  return {
    form,
    submit,
    loading,
    resetForm: () => {
      form.reset(EMPTY);
    },
  };
}
