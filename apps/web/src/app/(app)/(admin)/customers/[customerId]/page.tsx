import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { CustomerKhataPanel } from '@/features/customers';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Customer khata' };

/** One customer's khata (F-25 `#20`). */
export default async function CustomerKhataPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/customers">
          <ArrowLeftIcon /> All customers
        </Link>
      </Button>
      <CustomerKhataPanel customerId={customerId} />
    </div>
  );
}
