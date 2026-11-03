'use client';

import { BookUserIcon, TruckIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CustomerKhataPanel, CustomersPanel } from '@/features/customers';
import { VendorKhataPanel, VendorsPanel } from '@/features/vendors';

import { PartyModal } from './PartyModal';

/** Header buttons that open the Khata and Vendors modals (F-28, D-11: cashiers use both). */
export function KhataButtons() {
  const [open, setOpen] = useState<'customers' | 'vendors' | null>(null);
  const change = (next: boolean): void => {
    if (!next) setOpen(null);
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen('customers');
        }}
      >
        <BookUserIcon /> Khata
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen('vendors');
        }}
      >
        <TruckIcon /> Vendors
      </Button>
      <PartyModal
        title="Customer khata"
        open={open === 'customers'}
        onOpenChange={change}
        list={(openKhata) => <CustomersPanel onOpen={openKhata} showKpis={false} />}
        khata={(id) => <CustomerKhataPanel customerId={id} />}
      />
      <PartyModal
        title="Vendor khata"
        open={open === 'vendors'}
        onOpenChange={change}
        list={(openKhata) => <VendorsPanel onOpen={openKhata} showKpis={false} />}
        khata={(id) => <VendorKhataPanel vendorId={id} />}
      />
    </>
  );
}
