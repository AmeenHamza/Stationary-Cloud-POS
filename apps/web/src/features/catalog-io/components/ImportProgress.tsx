'use client';

import { useQuery } from '@apollo/client/react';
import { CircleCheckIcon, DownloadIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFileDownload } from '@/hooks/useFileDownload';

import { ImportJobDocument } from '../graphql/catalog-io.documents';

/**
 * An import's progress (F-11, E2E-12): read once, then moved forward by `import.progressed` events
 * (no polling). When done: how many rows were applied, and the refused rows' report.
 */
export function ImportProgress({ jobId }: { jobId: string }) {
  const { data } = useQuery(ImportJobDocument, { variables: { id: jobId } });
  const { download, busy } = useFileDownload();
  const job = data?.importJob;
  if (job == null) {
    return <p className="text-sm text-muted-foreground">Starting the import…</p>;
  }
  const share = job.totalRows === 0 ? 1 : job.processedRows / job.totalRows;
  const done = job.status === 'COMPLETED' || job.status === 'FAILED';
  return (
    <div className="grid gap-3" data-import-status={job.status}>
      <div
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={job.totalRows}
        aria-valuenow={job.processedRows}
        className="h-2.5 overflow-hidden rounded-full bg-chart-accent/20"
      >
        <div
          className="h-full rounded-full bg-chart-accent transition-[width]"
          style={{ width: `${String(share * 100)}%` }}
        />
      </div>
      <p className="text-sm">
        {done ? (
          <span className="flex items-center gap-1.5 font-medium">
            <CircleCheckIcon className="size-4 text-success" aria-hidden /> Import finished:{' '}
            {job.succeededRows} applied, {job.failedRows} refused.
          </span>
        ) : (
          `${job.status === 'QUEUED' ? 'Queued' : 'Importing'}: ${String(job.processedRows)} of ${String(job.totalRows)} rows`
        )}
      </p>
      {job.errorSummary !== null && <p className="text-sm text-destructive">{job.errorSummary}</p>}
      {done && job.failedRows > 0 && (
        <Button
          variant="outline"
          className="w-fit"
          disabled={busy}
          onClick={() => void download(`/v1/imports/${jobId}/errors.csv`, 'import-errors.csv')}
        >
          <DownloadIcon /> Download the refused rows
        </Button>
      )}
    </div>
  );
}
