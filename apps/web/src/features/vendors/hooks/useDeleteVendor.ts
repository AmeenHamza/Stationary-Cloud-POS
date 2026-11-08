'use client';

import { useMutation } from '@apollo/client/react';

import { usePartyDeletion } from '@/components/ledger/usePartyDeletion';
import { useCan } from '@/features/auth';

import { DeleteVendorDocument } from '../graphql/vendors.documents';

/** Removes a vendor with no khata entries (D-28); the server refuses any other. */
export function useDeleteVendor(showKpis: boolean) {
  const allowed = useCan('vendors:archive');
  const [remove] = useMutation(DeleteVendorDocument, {
    refetchQueries: showKpis ? ['Vendors', 'VendorKpis'] : ['Vendors'],
  });
  return usePartyDeletion({
    allowed,
    description:
      'This removes the vendor from the database for good. A vendor with khata entries cannot be deleted: archive them instead.',
    remove: (id) => remove({ variables: { id } }),
  });
}
