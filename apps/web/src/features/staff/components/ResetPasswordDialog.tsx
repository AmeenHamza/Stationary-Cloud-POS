'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { resetStaffPasswordInputSchema } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import { ResetStaffPasswordDocument } from '../graphql/staff.documents';

import type { StaffMember } from '../staff-user';
import type { z } from 'zod';

const schema = resetStaffPasswordInputSchema.pick({ newPassword: true });
type ResetForm = z.input<typeof schema>;

/** Admin sets a new password (F-31); every session of that person is signed out. */
export function ResetPasswordDialog({
  member,
  onOpenChange,
}: {
  member: StaffMember;
  onOpenChange: (open: boolean) => void;
}) {
  const [reset, { loading }] = useMutation(ResetStaffPasswordDocument);
  const { register, handleSubmit, formState, setError } = useForm<
    ResetForm,
    unknown,
    z.output<typeof schema>
  >({ resolver: zodResolver(schema), defaultValues: { newPassword: '' } });

  const submit = handleSubmit(async ({ newPassword }) => {
    try {
      await reset({ variables: { input: { id: member.id, newPassword } } });
      toast.success(`Password reset. ${member.fullName} must sign in with the new password.`);
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors(error, setError, ['newPassword']);
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`Reset password for ${member.fullName}`}
      description="They will be signed out on every counter and must use the new password."
      submitLabel="Reset password"
      busy={loading}
      onSubmit={submit}
    >
      <FormTextField
        name="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        register={register}
        error={formState.errors.newPassword?.message}
      />
    </FormDialog>
  );
}
