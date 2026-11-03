'use client';

import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { VendorsPanel } from '@/features/vendors';

/** Vendors (F-26): opening a khata navigates to its own page. */
export function VendorsRoute() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Vendors" description="Supplier khata: what the shop owes each vendor." />
      <VendorsPanel
        onOpen={(id) => {
          router.push(`/vendors/${id}`);
        }}
      />
    </>
  );
}
