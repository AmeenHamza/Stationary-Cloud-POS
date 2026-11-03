'use client';

import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';

import { formatRs } from '@pos/domain';

import {
  AddVendorPurchaseDocument,
  ArchiveVendorDocument,
  PayVendorDocument,
  RestoreVendorDocument,
  UpdateVendorDocument,
} from '../graphql/vendors.documents';

import type { KhataActionsConfig } from '@/components/ledger/KhataActions';
import type { VendorFieldsFragment } from '@/graphql/__generated__/graphql';

/** Mutations behind the vendor khata actions (D-20: purchases never change stock). */
export function useVendorKhata(
  vendor: VendorFieldsFragment,
): Pick<KhataActionsConfig, 'onRaise' | 'onLower' | 'onEdit' | 'onArchive'> {
  const refetch = { refetchQueries: ['VendorLedger'] };
  const [purchase] = useMutation(AddVendorPurchaseDocument, refetch);
  const [pay] = useMutation(PayVendorDocument, refetch);
  const [update] = useMutation(UpdateVendorDocument);
  const [archive] = useMutation(ArchiveVendorDocument, { refetchQueries: ['Vendors'] });
  const [restore] = useMutation(RestoreVendorDocument, { refetchQueries: ['Vendors'] });
  const vendorId = vendor.id;
  return {
    onRaise: async ({ idempotencyKey, amount, note }) => {
      const input = { idempotencyKey, vendorId, amount, description: note };
      await purchase({ variables: { input } });
      toast.success(`Purchase of ${formatRs(amount)} recorded.`);
    },
    onLower: async ({ idempotencyKey, amount, method, note }) => {
      await pay({ variables: { input: { idempotencyKey, vendorId, amount, method, note } } });
      toast.success(`Payment of ${formatRs(amount)} recorded.`);
    },
    onEdit: async (values) => {
      await update({ variables: { input: { ...values, id: vendorId, version: vendor.version } } });
      toast.success('Saved.');
    },
    onArchive: async (archived) => {
      const variables = { id: vendorId };
      await (archived ? archive({ variables }) : restore({ variables }));
      toast.success(archived ? `${vendor.name} archived.` : `${vendor.name} restored.`);
    },
  };
}
