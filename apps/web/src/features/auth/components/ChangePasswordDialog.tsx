'use client';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormTextField } from '@/components/forms/FormTextField';

import { useChangePasswordForm } from '../hooks/useChangePasswordForm';

/** Change own password (F-03). Other signed-in devices are signed out by the server. */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { form, submit, loading, resetForm } = useChangePasswordForm(() => {
    onOpenChange(false);
  });
  const { register, formState } = form;

  const change = (next: boolean): void => {
    if (!next) {
      resetForm();
    }
    onOpenChange(next);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={change}
      title="Change password"
      description="Use at least 8 characters. You stay signed in here."
      submitLabel="Change password"
      busy={loading}
      onSubmit={submit}
    >
      <FormTextField
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        register={register}
        error={formState.errors.currentPassword?.message}
      />
      <FormTextField
        name="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        register={register}
        error={formState.errors.newPassword?.message}
      />
      <FormTextField
        name="confirmNewPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        register={register}
        error={formState.errors.confirmNewPassword?.message}
      />
    </FormDialog>
  );
}
