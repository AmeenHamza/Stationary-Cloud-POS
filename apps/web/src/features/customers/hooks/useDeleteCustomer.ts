'use client';

import { useMutation } from '@apollo/client/react';

import { usePartyDeletion } from '@/components/ledger/usePartyDeletion';
import { useCan } from '@/features/auth';

import { DeleteCustomerDocument } from '../graphql/customers.documents';

/** Removes a customer with no bills or khata entries (D-28); the server refuses any other. */
export function useDeleteCustomer(showKpis: boolean) {
  const allowed = useCan('customers:archive');
  const [remove] = useMutation(DeleteCustomerDocument, {
    refetchQueries: showKpis ? ['Customers', 'CustomerKpis'] : ['Customers'],
  });
  return usePartyDeletion({
    allowed,
    description:
      'This removes the customer from the database for good. A customer with bills or khata entries cannot be deleted: archive them instead.',
    remove: (id) => remove({ variables: { id } }),
  });
}
