import { CustomersRoute } from './CustomersRoute';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Customers' };

/** Customer khata list (F-25). */
export default function CustomersPage() {
  return <CustomersRoute />;
}
