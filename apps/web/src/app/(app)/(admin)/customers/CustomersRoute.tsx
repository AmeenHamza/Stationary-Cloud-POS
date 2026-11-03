'use client';

import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { CustomersPanel } from '@/features/customers';

/** Customers (F-25): opening a khata navigates to its own page. */
export function CustomersRoute() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Customers" description="Udhaar khata: what each customer owes the shop." />
      <CustomersPanel
        onOpen={(id) => {
          router.push(`/customers/${id}`);
        }}
      />
    </>
  );
}
