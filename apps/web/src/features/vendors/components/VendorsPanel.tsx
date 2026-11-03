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

import {
  CreateVendorDocument,
  VendorKpisDocument,
  VendorsDocument,
} from '../graphql/vendors.documents';
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
  const { data: kpis } = useQuery(
    VendorKpisDocument,
    showKpis ? undefined : skipToken,
  );
  const [create] = useMutation(CreateVendorDocument, { refetchQueries: ['Vendors'] });
  const connection = data?.vendors;
  return (
    <>
      {showKpis && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <RevealKpiCard label="Total vendors" value={String(kpis?.dashboard.vendorCount ?? 0)} />
          <RevealKpiCard
            label="Total amount owed"
            value={formatRs(kpis?.dashboard.vendorOwes ?? '0')}
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
          <PlusIcon /> Add vendor
        </Button>
      </div>
      <PartyListView
        {...list.view}
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
