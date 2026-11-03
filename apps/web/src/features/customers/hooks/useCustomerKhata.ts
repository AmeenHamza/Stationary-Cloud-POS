'use client';

import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';

import { formatRs } from '@pos/domain';

import {
  AddCustomerCreditDocument,
  ArchiveCustomerDocument,
  ReceiveCustomerPaymentDocument,
  RestoreCustomerDocument,
  UpdateCustomerDocument,
} from '../graphql/customers.documents';

import type { KhataActionsConfig } from '@/components/ledger/KhataActions';
import type { CustomerFieldsFragment } from '@/graphql/__generated__/graphql';

/** Mutations behind the customer khata actions; each re-reads the open ledger page. */
export function useCustomerKhata(
  customer: CustomerFieldsFragment,
): Pick<KhataActionsConfig, 'onRaise' | 'onLower' | 'onEdit' | 'onArchive'> {
  const refetch = { refetchQueries: ['CustomerLedger'] };
  const [credit] = useMutation(AddCustomerCreditDocument, refetch);
  const [payment] = useMutation(ReceiveCustomerPaymentDocument, refetch);
  const [update] = useMutation(UpdateCustomerDocument);
  const [archive] = useMutation(ArchiveCustomerDocument, { refetchQueries: ['Customers'] });
  const [restore] = useMutation(RestoreCustomerDocument, { refetchQueries: ['Customers'] });
  const customerId = customer.id;
  return {
    onRaise: async ({ idempotencyKey, amount, note }) => {
      await credit({ variables: { input: { idempotencyKey, customerId, amount, note } } });
      toast.success(`Udhaar of ${formatRs(amount)} added.`);
    },
    onLower: async ({ idempotencyKey, amount, method, note }) => {
      await payment({ variables: { input: { idempotencyKey, customerId, amount, method, note } } });
      toast.success(`Payment of ${formatRs(amount)} received.`);
    },
    onEdit: async ({ name, phone, email, address }) => {
      const input = { id: customerId, version: customer.version, name, phone, email, address };
      await update({ variables: { input } });
      toast.success('Saved.');
    },
    onArchive: async (archived) => {
      const variables = { id: customerId };
      await (archived ? archive({ variables }) : restore({ variables }));
      toast.success(archived ? `${customer.name} archived.` : `${customer.name} restored.`);
    },
  };
}
