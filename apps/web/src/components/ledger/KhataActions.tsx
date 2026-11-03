'use client';

import { ArchiveIcon, ArchiveRestoreIcon, MinusIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { ArchiveConfirm } from './ArchiveConfirm';
import { KhataEntryDialog, type KhataEntryValues } from './KhataEntryDialog';
import { PartyFormDialog, type PartyFormInitial } from './PartyFormDialog';

import type { CreateVendorInput } from '@pos/validation';

export interface KhataActionsConfig {
  /** "Add Udhaar" / "Add purchase": raises the balance. */
  raise: { label: string; description: string; noteLabel: string };
  /** "Receive payment" / "Make payment": lowers the balance. */
  lower: { label: string; description: string };
  party: PartyFormInitial & { name: string; archived: boolean };
  withProducts: boolean;
  canArchive: boolean;
  onRaise: (values: KhataEntryValues) => Promise<void>;
  onLower: (values: KhataEntryValues) => Promise<void>;
  onEdit: (values: CreateVendorInput) => Promise<void>;
  onArchive: (archive: boolean) => Promise<void>;
}

type Dialog = 'raise' | 'lower' | 'edit' | 'archive' | null;

function KhataDialogs({
  dialog,
  config,
  onClose,
}: {
  dialog: Dialog;
  config: KhataActionsConfig;
  onClose: () => void;
}) {
  const close = (open: boolean): void => {
    if (!open) onClose();
  };
  const { party, raise, lower } = config;
  return (
    <>
      {dialog === 'raise' && (
        <KhataEntryDialog
          {...raise}
          title={raise.label}
          submitLabel={raise.label}
          withMethod={false}
          onSubmit={config.onRaise}
          onOpenChange={close}
        />
      )}
      {dialog === 'lower' && (
        <KhataEntryDialog
          {...lower}
          title={lower.label}
          submitLabel={lower.label}
          withMethod
          onSubmit={config.onLower}
          onOpenChange={close}
        />
      )}
      {dialog === 'edit' && (
        <PartyFormDialog
          title={`Edit ${party.name}`}
          submitLabel="Save"
          initial={party}
          withProducts={config.withProducts}
          onSubmit={config.onEdit}
          onOpenChange={close}
        />
      )}
      <ArchiveConfirm
        open={dialog === 'archive'}
        name={party.name}
        archived={party.archived}
        onConfirm={config.onArchive}
        onClose={onClose}
      />
    </>
  );
}

/**
 * The khata action bar (FEATURES.md §3.9–3.10): raise, lower, edit and archive/restore, each with
 * its dialog. Archived khata take no entries; archive appears only for roles that may (D-11, Q33).
 */
export function KhataActions({ config }: { config: KhataActionsConfig }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const button = (target: Exclude<Dialog, null>) => () => {
    setDialog(target);
  };
  const { party } = config;
  return (
    <>
      {!party.archived && (
        <>
          <Button variant="brand" onClick={button('raise')}>
            <PlusIcon /> {config.raise.label}
          </Button>
          <Button variant="outline" onClick={button('lower')}>
            <MinusIcon /> {config.lower.label}
          </Button>
        </>
      )}
      <Button variant="outline" onClick={button('edit')}>
        <PencilIcon /> Edit
      </Button>
      {config.canArchive && (
        <Button variant="ghost" onClick={button('archive')}>
          {party.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
          {party.archived ? 'Restore' : 'Archive'}
        </Button>
      )}
      <KhataDialogs
        dialog={dialog}
        config={config}
        onClose={() => {
          setDialog(null);
        }}
      />
    </>
  );
}
