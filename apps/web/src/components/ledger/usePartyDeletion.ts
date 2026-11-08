'use client';

import { useConfirmedDelete, type ConfirmedDelete } from '@/hooks/useConfirmedDelete';

import type { PartySummary } from './khata-labels';

export interface PartyDeletion {
  control: ConfirmedDelete<PartySummary>;
  description: string;
}

/**
 * Deleting a customer or vendor from `<PartyListView>` (D-28), which spreads this result: nothing for
 * a role that may not delete, so the button and its dialog are not there at all.
 */
export function usePartyDeletion(options: {
  allowed: boolean;
  description: string;
  remove: (id: string) => Promise<unknown>;
}): { deletion?: PartyDeletion } {
  const control = useConfirmedDelete<PartySummary>({
    nameOf: (party) => party.name,
    remove: (party) => options.remove(party.id),
  });
  return options.allowed ? { deletion: { control, description: options.description } } : {};
}
