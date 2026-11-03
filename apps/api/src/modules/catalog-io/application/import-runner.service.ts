import { Injectable } from '@nestjs/common';

import { isUniqueViolation } from '../../../common/errors/prisma-error.mapper';
import { ClockService } from '../../../common/time/clock.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { ProductImportService, type ImportedProduct } from '../../catalog';
import { ImportJobsRepository, type ImportJobRow } from '../persistence/import-jobs.repository';

import { ImportEvents } from './import-events';

/** Rows applied per transaction (SYSTEM_DESIGN.md §7). */
export const IMPORT_BATCH_SIZE = 100;

type PendingRow = Awaited<ReturnType<ImportJobsRepository['pending']>>[number];

/** Why the database refused one row, in words the admin can act on. */
function rowError(error: unknown): string {
  if (isUniqueViolation(error, 'barcode'))
    return 'Another active product already uses this barcode';
  if ((error as { code?: unknown }).code === 'P2003') return 'The category no longer exists';
  return 'This row could not be saved';
}

/**
 * The import worker (SYSTEM_DESIGN.md §7): applies the job's `PENDING` rows in batches of 100,
 * one transaction each, with row results, counters and `import.progressed` in that transaction.
 * Only `PENDING` rows are read, so a retried or re-queued job never applies a row twice. A batch
 * the database refuses is re-run row by row, so one bad row fails alone.
 */
@Injectable()
export class ImportRunner {
  constructor(
    private readonly jobs: ImportJobsRepository,
    private readonly products: ProductImportService,
    private readonly events: ImportEvents,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly uow: UnitOfWork,
  ) {}

  async run(importJobId: string): Promise<void> {
    const job = await this.jobs.findById(importJobId);
    if (job === null || job.status === 'COMPLETED' || job.status === 'FAILED') {
      return;
    }
    if (job.status === 'QUEUED') {
      await this.uow.run(async () => {
        await this.events.progressed(
          await this.jobs.setStatus(job.id, 'RUNNING', this.clock.now()),
        );
      });
    }
    let batch = await this.jobs.pending(job.id, IMPORT_BATCH_SIZE);
    while (batch.length > 0) {
      try {
        await this.uow.run(() => this.apply(job, batch));
      } catch {
        for (const row of batch) {
          await this.uow
            .run(() => this.apply(job, [row]))
            .catch((error: unknown) => this.uow.run(() => this.refuse(job, row, rowError(error))));
        }
      }
      batch = await this.jobs.pending(job.id, IMPORT_BATCH_SIZE);
    }
    await this.uow.run(async () => {
      const done = await this.jobs.setStatus(job.id, 'COMPLETED', this.clock.now());
      await this.events.progressed(done);
      await this.products.finish(job.id, done.succeededRows);
      await this.audit.record('catalog.importCompleted', job.createdById, {
        entityType: 'importJob',
        entityId: job.id,
        metadata: { succeeded: done.succeededRows, failed: done.failedRows },
      });
    });
  }

  private async apply(job: ImportJobRow, rows: readonly PendingRow[]): Promise<void> {
    for (const row of rows) {
      const data = row.data as unknown as ImportedProduct; // validated when staged
      const { productId } = await this.products.apply(data, job.id, job.createdById);
      await this.jobs.markRow(row.id, { productId });
    }
    await this.events.progressed(await this.jobs.count(job.id, rows.length, 0));
  }

  private async refuse(job: ImportJobRow, row: PendingRow, error: string): Promise<void> {
    await this.jobs.markRow(row.id, { error });
    await this.events.progressed(await this.jobs.count(job.id, 0, 1));
  }
}
