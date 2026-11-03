import { LowStockScreen } from '@/features/catalog';
import { LowStockExport } from '@/features/catalog-io';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Low stock' };

/** Low-stock list with its CSV and PDF export (F-13). */
export default function LowStockPage() {
  return <LowStockScreen extraActions={<LowStockExport />} />;
}
