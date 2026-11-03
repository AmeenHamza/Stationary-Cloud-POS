'use client';

import { useQuery } from '@apollo/client/react';

import { KhataActions } from '@/components/ledger/KhataActions';
import { PartyLedgerView } from '@/components/ledger/PartyLedgerView';
import { useLedgerPages } from '@/components/ledger/usePartyList';
import { useCan } from '@/features/auth';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { VendorDocument, VendorLedgerDocument } from '../graphql/vendors.documents';
import { useVendorKhata } from '../hooks/useVendorKhata';
import { VENDOR_BALANCE_LABELS, VENDOR_ENTRY_LABELS, vendorSummary } from '../vendor-labels';

import type { VendorFieldsFragment } from '@/graphql/__generated__/graphql';

function VendorKhata({ vendor }: { vendor: VendorFieldsFragment }) {
  const ledgerPages = useLedgerPages();
  const mutations = useVendorKhata(vendor);
  const canArchive = useCan('vendors:archive');
  const { data, error } = useQuery(VendorLedgerDocument, {
    variables: {
      vendorId: vendor.id,
      after: ledgerPages.pages.after,
      includeArchived: ledgerPages.includeArchived,
    },
  });
  return (
    <PartyLedgerView
      {...ledgerPages}
      party={vendorSummary(vendor)}
      labels={VENDOR_BALANCE_LABELS}
      balanceTitle="Outstanding dues (we owe)"
      typeLabels={VENDOR_ENTRY_LABELS}
      ledger={data?.vendorLedger}
      error={error}
      actions={
        <KhataActions
          config={{
            ...mutations,
            raise: {
              label: 'Add purchase',
              description:
                'Maal khareeda: the amount is added to what the shop owes. Stock is not changed.',
              noteLabel: 'Description (optional)',
            },
            lower: {
              label: 'Make payment',
              description: 'A payment or installment: the amount is taken off what the shop owes.',
            },
            party: { ...vendor, archived: vendor.archivedAt !== null },
            withProducts: true,
            canArchive,
          }}
        />
      }
    />
  );
}

/** One vendor's khata (F-26 `#24`): dues, actions and the ledger. */
export function VendorKhataPanel({ vendorId }: { vendorId: string }) {
  const { data, error } = useQuery(VendorDocument, { variables: { id: vendorId } });
  if (error !== undefined) {
    return <p className="text-destructive">{userMessageOf(error)}</p>;
  }
  if (data === undefined) {
    return <p className="text-muted-foreground">Loading khata…</p>;
  }
  if (data.vendor === null) {
    return <p className="text-muted-foreground">This vendor does not exist.</p>;
  }
  return <VendorKhata vendor={data.vendor} />;
}
