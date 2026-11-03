'use client';

import { useQuery } from '@apollo/client/react';

import { KhataActions } from '@/components/ledger/KhataActions';
import { PartyLedgerView } from '@/components/ledger/PartyLedgerView';
import { useLedgerPages } from '@/components/ledger/usePartyList';
import { useCan } from '@/features/auth';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { CUSTOMER_BALANCE_LABELS, CUSTOMER_ENTRY_LABELS } from '../customer-labels';
import { CustomerDocument, CustomerLedgerDocument } from '../graphql/customers.documents';
import { useCustomerKhata } from '../hooks/useCustomerKhata';

import type { CustomerFieldsFragment } from '@/graphql/__generated__/graphql';

function CustomerKhata({ customer }: { customer: CustomerFieldsFragment }) {
  const ledgerPages = useLedgerPages();
  const mutations = useCustomerKhata(customer);
  const canArchive = useCan('customers:archive');
  const { data, error } = useQuery(CustomerLedgerDocument, {
    variables: {
      customerId: customer.id,
      after: ledgerPages.pages.after,
      includeArchived: ledgerPages.includeArchived,
    },
  });
  return (
    <PartyLedgerView
      {...ledgerPages}
      party={customer}
      labels={CUSTOMER_BALANCE_LABELS}
      balanceTitle="Outstanding balance"
      typeLabels={CUSTOMER_ENTRY_LABELS}
      ledger={data?.customerLedger}
      error={error}
      actions={
        <KhataActions
          config={{
            ...mutations,
            raise: {
              label: 'Add Udhaar',
              description: 'Goods given on credit: the amount is added to what the customer owes.',
              noteLabel: 'Note (optional)',
            },
            lower: {
              label: 'Receive payment',
              description: 'Money received: the amount is taken off what the customer owes.',
            },
            party: { ...customer, archived: customer.archivedAt !== null },
            withProducts: false,
            canArchive,
          }}
        />
      }
    />
  );
}

/** One customer's khata (F-25 `#20`): balance, actions and the ledger. Live via balance events. */
export function CustomerKhataPanel({ customerId }: { customerId: string }) {
  const { data, error } = useQuery(CustomerDocument, { variables: { id: customerId } });
  if (error !== undefined) {
    return <p className="text-destructive">{userMessageOf(error)}</p>;
  }
  if (data === undefined) {
    return <p className="text-muted-foreground">Loading khata…</p>;
  }
  if (data.customer === null) {
    return <p className="text-muted-foreground">This customer does not exist.</p>;
  }
  return <CustomerKhata customer={data.customer} />;
}
