'use client';

import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { PartyFormDialog } from '@/components/ledger/PartyFormDialog';
import { PartyListView } from '@/components/ledger/PartyListView';
import { PartyPanelHeader } from '@/components/ledger/PartyPanelHeader';
import { usePartyList } from '@/components/ledger/usePartyList';

import {
  CreateVendorDocument,
  VendorKpisDocument,
  VendorsDocument,
} from '../graphql/vendors.documents';
import { useDeleteVendor } from '../hooks/useDeleteVendor';
import { VENDOR_BALANCE_LABELS, vendorSummary } from '../vendor-labels';

/**
 * Supplier list with search and Add vendor (F-26). Used by the admin Vendors page and the
 * terminal's Vendors modal; `onOpen` decides where the khata opens.
 */
export function VendorsPanel({
  onOpen,
  showKpis = true,
}: {
  onOpen: (vendorId: string) => void;
  showKpis?: boolean;
}) {
  const list = usePartyList();
  const [adding, setAdding] = useState(false);
  const { data, error } = useQuery(VendorsDocument, { variables: list.variables });
  const { data: kpis } = useQuery(VendorKpisDocument, showKpis ? undefined : skipToken);
  const [create] = useMutation(CreateVendorDocument, { refetchQueries: ['Vendors'] });
  const deletable = useDeleteVendor(showKpis);
  const connection = data?.vendors;
  return (
    <>
      <PartyPanelHeader
        kpis={
          showKpis
            ? {
                countLabel: 'Total vendors',
                count: kpis?.dashboard.vendorCount,
                amountLabel: 'Total amount owed',
                amount: kpis?.dashboard.vendorOwes,
              }
            : null
        }
        addLabel="Add vendor"
        onAdd={() => {
          setAdding(true);
        }}
      />
      <PartyListView
        {...list.view}
        {...deletable}
        noun="vendor"
        detailHeading="Products"
        connection={connection && { ...connection, nodes: connection.nodes.map(vendorSummary) }}
        error={error}
        labels={VENDOR_BALANCE_LABELS}
        onOpen={(party) => {
          onOpen(party.id);
        }}
      />
      {adding && (
        <PartyFormDialog
          title="Add vendor"
          submitLabel="Add vendor"
          initial={null}
          withProducts
          onSubmit={async (input) => {
            const result = await create({ variables: { input } });
            toast.success(`${input.name} added.`);
            const id = result.data?.createVendor.id;
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
