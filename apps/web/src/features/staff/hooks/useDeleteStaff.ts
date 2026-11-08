'use client';

import { useMutation } from '@apollo/client/react';

import { useConfirmedDelete } from '@/hooks/useConfirmedDelete';

import { DeleteStaffUserDocument } from '../graphql/staff.documents';

import type { StaffMember } from '../staff-user';

/**
 * Removes an account from the database (D-28). The server refuses one with bills or other work on
 * record, your own account and the last active admin; those can only be disabled, if at all.
 */
export function useDeleteStaff() {
  const [remove] = useMutation(DeleteStaffUserDocument, { refetchQueries: ['StaffUsers'] });
  return useConfirmedDelete<StaffMember>({
    nameOf: (member) => member.fullName,
    remove: (member) => remove({ variables: { id: member.id } }),
  });
}
