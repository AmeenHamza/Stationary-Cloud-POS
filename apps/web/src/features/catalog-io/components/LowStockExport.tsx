'use client';

import { DownloadIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFileDownload } from '@/hooks/useFileDownload';

/** The low-stock list as CSV or PDF (F-13, FEATURES.md §3.5), for reordering. */
export function LowStockExport() {
  const { download, busy } = useFileDownload();
  return (
    <>
      {(['csv', 'pdf'] as const).map((format) => (
        <Button
          key={format}
          variant="outline"
          disabled={busy}
          onClick={() =>
            void download(`/v1/exports/low-stock?format=${format}`, `low-stock.${format}`)
          }
        >
          <DownloadIcon /> {format.toUpperCase()}
        </Button>
      ))}
    </>
  );
}
