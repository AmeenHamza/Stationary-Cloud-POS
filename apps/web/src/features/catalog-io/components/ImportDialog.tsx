'use client';

import { FileSpreadsheetIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useFileDownload } from '@/hooks/useFileDownload';

import { uploadImport } from '../lib/upload-import';

import { ImportProgress } from './ImportProgress';

/**
 * Import products from a template or legacy file (F-11, Q14): rows are matched by barcode (updated if found,
 * added if not; stock only for new products), and refused rows are listed in a report. The work
 * continues on the server if this dialog is closed.
 */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { download } = useFileDownload();
  const close = () => {
    setFile(null);
    setJobId(null);
    setError(null);
    onClose();
  };
  const send = async () => {
    if (file === null) return;
    setSending(true);
    setError(null);
    try {
      setJobId(await uploadImport(file));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The upload failed.');
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import products</DialogTitle>
          <DialogDescription>
            An .xlsx or .csv file using template or supported legacy headers, up to 5,000 rows and 5
            MB. Existing product stock is not changed. Keep barcodes as text to preserve leading
            zeros.
          </DialogDescription>
        </DialogHeader>
        {jobId === null ? (
          <div className="grid gap-3">
            <Button
              variant="link"
              className="w-fit px-0"
              onClick={() =>
                void download('/v1/imports/products/template.xlsx', 'product-import-template.xlsx')
              }
            >
              <FileSpreadsheetIcon /> Download the template
            </Button>
            <Input
              type="file"
              accept=".xlsx,.csv"
              aria-label="Product file"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
            {error !== null && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button disabled={file === null || sending} onClick={() => void send()}>
              <UploadIcon /> {sending ? 'Uploading…' : 'Import'}
            </Button>
          </div>
        ) : (
          <ImportProgress jobId={jobId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
