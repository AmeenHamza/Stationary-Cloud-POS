import { VendorsRoute } from './VendorsRoute';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Vendors' };

/** Supplier khata list (F-26). */
export default function VendorsPage() {
  return <VendorsRoute />;
}
