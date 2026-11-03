'use client';

import { DownloadIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFileDownload } from '@/hooks/useFileDownload';

import { ImportDialog } from './ImportDialog';

const FORMATS = [
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel (.xlsx)' },
  { format: 'pdf', label: 'PDF' },
] as const;

/** Products' Import and Export (F-11, FEATURES.md §3.3): template, upload, CSV / XLSX / PDF. */
export function ProductTransferActions() {
  const [importing, setImporting] = useState(false);
  const { download, busy } = useFileDownload();
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setImporting(true);
        }}
      >
        <UploadIcon /> Import
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy}>
            <DownloadIcon /> Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {FORMATS.map(({ format, label }) => (
            <DropdownMenuItem
              key={format}
              onSelect={() =>
                void download(`/v1/exports/products?format=${format}`, `products.${format}`)
              }
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportDialog
        open={importing}
        onClose={() => {
          setImporting(false);
        }}
      />
    </>
  );
}
