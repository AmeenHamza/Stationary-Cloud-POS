'use client';

import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { userMessageOf } from '@/lib/errors/graphql-error';

import { SetStaffUserStatusDocument } from '../graphql/staff.documents';

import type { StaffMember } from '../staff-user';

/**
 * Enable/disable with a confirmation step. Disabling signs the person out everywhere; the server
 * refuses to disable the last active admin (LAST_ADMIN) and the message says so.
 */
export function useStaffStatusToggle() {
  const [target, setTarget] = useState<StaffMember | null>(null);
  const [setStatus, { loading }] = useMutation(SetStaffUserStatusDocument);

  const confirm = async (): Promise<void> => {
    if (target === null) {
      return;
    }
    const status = target.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await setStatus({ variables: { input: { id: target.id, status } } });
      toast.success(
        status === 'DISABLED'
          ? `${target.fullName} is disabled and has been signed out.`
          : `${target.fullName} can sign in again.`,
      );
    } catch (error) {
      toast.error(userMessageOf(error));
    } finally {
      setTarget(null);
    }
  };

  const disabling = target?.status === 'ACTIVE';
  return {
    target,
    ask: setTarget,
    cancel: () => {
      setTarget(null);
    },
    confirm,
    busy: loading,
    title: target === null ? '' : `${disabling ? 'Disable' : 'Enable'} ${target.fullName}?`,
    description: disabling
      ? 'They will be signed out on every counter and cannot sign in until enabled again.'
      : 'They will be able to sign in again with their current password.',
    confirmLabel: disabling ? 'Disable' : 'Enable',
    destructive: disabling,
  };
}
