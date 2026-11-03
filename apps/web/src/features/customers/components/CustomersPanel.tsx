'use client';

import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { formatRs } from '@pos/domain';

import { PartyFormDialog } from '@/components/ledger/PartyFormDialog';
import { PartyListView } from '@/components/ledger/PartyListView';
import { usePartyList } from '@/components/ledger/usePartyList';
import { RevealKpiCard } from '@/components/metrics/RevealKpiCard';
import { Button } from '@/components/ui/button';

import { CUSTOMER_BALANCE_LABELS } from '../customer-labels';
import {
  CreateCustomerDocument,
  CustomerKpisDocument,
  CustomersDocument,
} from '../graphql/customers.documents';

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
  const { data: kpis } = useQuery(
    CustomerKpisDocument,
    showKpis ? undefined : skipToken,
  );
  const [create] = useMutation(CreateCustomerDocument, { refetchQueries: ['Customers'] });
  return (
    <>
      {showKpis && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <RevealKpiCard label="Total customers" value={String(kpis?.dashboard.customerCount ?? 0)} />
          <RevealKpiCard
            label="Customer dues"
            value={formatRs(kpis?.dashboard.customerDues ?? '0')}
          />
        </div>
      )}
      <div className="mb-4 flex justify-end">
        <Button
          variant="brand"
          onClick={() => {
            setAdding(true);
          }}
        >
          <PlusIcon /> Add customer
        </Button>
      </div>
      <PartyListView
        {...list.view}
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
