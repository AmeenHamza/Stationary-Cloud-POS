'use client';

import { ConfirmDialog } from './ConfirmDialog';

import type { ConfirmedDelete } from '@/hooks/useConfirmedDelete';

/** The confirmation step of a delete (D-28); `description` says what removing this row means. */
export function DeleteConfirm<T>({
  control,
  description,
}: {
  control: ConfirmedDelete<T>;
  description: string;
}) {
  return (
    <ConfirmDialog
      open={control.target !== null}
      title={control.title}
      description={description}
      confirmLabel="Delete"
      destructive
      busy={control.busy}
      onConfirm={() => void control.confirm()}
      onOpenChange={(open) => {
        if (!open) control.cancel();
      }}
    />
  );
}
