'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { userMessageOf } from '@/lib/errors/graphql-error';

/** Archive or restore a khata after confirmation (D-12); a refusal (e.g. BALANCE_NOT_ZERO) toasts. */
export function ArchiveConfirm({
  open,
  name,
  archived,
  onConfirm,
  onClose,
}: {
  open: boolean;
  name: string;
  archived: boolean;
  onConfirm: (archive: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      title={archived ? `Restore ${name}?` : `Archive ${name}?`}
      description={
        archived
          ? 'The khata becomes active again.'
          : 'Only a settled khata can be archived. It stays searchable under "Show archived".'
      }
      confirmLabel={archived ? 'Restore' : 'Archive'}
      destructive={!archived}
      busy={busy}
      onConfirm={() => {
        setBusy(true);
        void onConfirm(!archived)
          .catch((failure: unknown) => {
            toast.error(userMessageOf(failure));
          })
          .finally(() => {
            setBusy(false);
            onClose();
          });
      }}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    />
  );
}
