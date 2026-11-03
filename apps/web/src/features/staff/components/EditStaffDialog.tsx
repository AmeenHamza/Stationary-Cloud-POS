'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { updateStaffUserInputSchema } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormSelectField } from '@/components/forms/FormSelectField';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import { UpdateStaffUserDocument } from '../graphql/staff.documents';

import { ROLE_OPTIONS } from './role-options';

import type { StaffMember } from '../staff-user';
import type { z } from 'zod';

const editSchema = updateStaffUserInputSchema.pick({ fullName: true, role: true });
type EditForm = z.input<typeof editSchema>;

/** Name and role. A role change signs the person out so the new permissions apply at once. */
export function EditStaffDialog({
  member,
  onOpenChange,
}: {
  member: StaffMember;
  onOpenChange: (open: boolean) => void;
}) {
  const [update, { loading }] = useMutation(UpdateStaffUserDocument);
  const { register, handleSubmit, formState, setError } = useForm<
    EditForm,
    unknown,
    z.output<typeof editSchema>
  >({
    resolver: zodResolver(editSchema),
    defaultValues: { fullName: member.fullName, role: member.role },
  });
  const submit = handleSubmit(async ({ fullName, role }) => {
    try {
      await update({
        variables: { input: { id: member.id, version: member.version, fullName, role } },
      });
      toast.success(role === member.role ? 'Saved.' : `Saved. ${fullName} must sign in again.`);
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors(error, setError, ['fullName', 'role']);
    }
  });
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`Edit ${member.fullName}`}
      submitLabel="Save"
      busy={loading}
      onSubmit={submit}
      description={`Username: ${member.username}`}
    >
      <FormTextField
        name="fullName"
        label="Full name"
        register={register}
        error={formState.errors.fullName?.message}
      />
      <FormSelectField
        name="role"
        label="Role"
        register={register}
        options={ROLE_OPTIONS}
        error={formState.errors.role?.message}
      />
    </FormDialog>
  );
}
