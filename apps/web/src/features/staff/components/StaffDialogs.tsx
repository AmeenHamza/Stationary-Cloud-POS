'use client';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';

import { CreateStaffDialog } from './CreateStaffDialog';
import { EditStaffDialog } from './EditStaffDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

import type { useStaffStatusToggle } from '../hooks/useStaffStatusToggle';
import type { StaffMember } from '../staff-user';

export interface StaffDialogState {
  creating: boolean;
  editing: StaffMember | null;
  resetting: StaffMember | null;
  close: (dialog: 'creating' | 'editing' | 'resetting') => void;
  toggle: ReturnType<typeof useStaffStatusToggle>;
}

/** The Staff screen's dialogs: add, edit, reset password and enable/disable confirmation. */
export function StaffDialogs({ creating, editing, resetting, close, toggle }: StaffDialogState) {
  return (
    <>
      <CreateStaffDialog
        open={creating}
        onOpenChange={(open) => {
          if (!open) close('creating');
        }}
      />
      {editing !== null && (
        <EditStaffDialog
          key={editing.id}
          member={editing}
          onOpenChange={() => {
            close('editing');
          }}
        />
      )}
      {resetting !== null && (
        <ResetPasswordDialog
          key={resetting.id}
          member={resetting}
          onOpenChange={() => {
            close('resetting');
          }}
        />
      )}
      <ConfirmDialog
        open={toggle.target !== null}
        title={toggle.title}
        description={toggle.description}
        confirmLabel={toggle.confirmLabel}
        destructive={toggle.destructive}
        busy={toggle.busy}
        onConfirm={() => void toggle.confirm()}
        onOpenChange={(open) => {
          if (!open) toggle.cancel();
        }}
      />
    </>
  );
}
