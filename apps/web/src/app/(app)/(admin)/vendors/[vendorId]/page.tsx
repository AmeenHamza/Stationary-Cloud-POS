import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { VendorKhataPanel } from '@/features/vendors';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Vendor khata' };

/** One vendor's khata (F-26 `#24`). */
export default async function VendorKhataPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/vendors">
          <ArrowLeftIcon /> All vendors
        </Link>
      </Button>
      <VendorKhataPanel vendorId={vendorId} />
    </div>
  );
}
