'use client';

import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { PartyFormDialog } from '@/components/ledger/PartyFormDialog';
import { PartyListView } from '@/components/ledger/PartyListView';
import { PartyPanelHeader } from '@/components/ledger/PartyPanelHeader';
import { usePartyList } from '@/components/ledger/usePartyList';

import { CUSTOMER_BALANCE_LABELS } from '../customer-labels';
import {
  CreateCustomerDocument,
  CustomerKpisDocument,
  CustomersDocument,
} from '../graphql/customers.documents';
import { useDeleteCustomer } from '../hooks/useDeleteCustomer';

/**
 * Customer list with search and Add customer (F-25). Used by the admin Customers page and the
 * terminal's Khata modal; `onOpen` decides where the khata opens.
 */
export function CustomersPanel({
  onOpen,
  showKpis = true,
}: {
  onOpen: (customerId: string) => void;
  showKpis?: boolean;
}) {
  const list = usePartyList();
  const [adding, setAdding] = useState(false);
  const { data, error } = useQuery(CustomersDocument, { variables: list.variables });
  const { data: kpis } = useQuery(CustomerKpisDocument, showKpis ? undefined : skipToken);
  const [create] = useMutation(CreateCustomerDocument, { refetchQueries: ['Customers'] });
  const deletable = useDeleteCustomer(showKpis);
  return (
    <>
      <PartyPanelHeader
        kpis={
          showKpis
            ? {
                countLabel: 'Total customers',
                count: kpis?.dashboard.customerCount,
                amountLabel: 'Customer dues',
                amount: kpis?.dashboard.customerDues,
              }
            : null
        }
        addLabel="Add customer"
        onAdd={() => {
          setAdding(true);
        }}
      />
      <PartyListView
        {...list.view}
        {...deletable}
        noun="customer"
        connection={data?.customers}
        error={error}
        labels={CUSTOMER_BALANCE_LABELS}
        onOpen={(party) => {
          onOpen(party.id);
        }}
      />
      {adding && (
        <PartyFormDialog
          title="Add customer"
          submitLabel="Add customer"
          initial={null}
          withProducts={false}
          onSubmit={async ({ name, phone, email, address }) => {
            const result = await create({ variables: { input: { name, phone, email, address } } });
            toast.success(`${name} added.`);
            const id = result.data?.createCustomer.id;
            if (id !== undefined) onOpen(id);
          }}
          onOpenChange={(open) => {
            if (!open) setAdding(false);
          }}
        />
      )}
    </>
  );
}
