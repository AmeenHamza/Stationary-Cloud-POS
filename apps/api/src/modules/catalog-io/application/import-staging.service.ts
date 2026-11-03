import { Injectable } from '@nestjs/common';

import { productImportRowSchema, type ProductImportRow } from '@pos/validation';

import { ClockService } from '../../../common/time/clock.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { ProductImportService, type ImportedProduct } from '../../catalog';
import { ImportJobsRepository, type StagedRow } from '../persistence/import-jobs.repository';

import { parseImportFile, type ParsedRow } from './import-file.parser';
import { ImportQueue } from './import-queue';

import type { Principal } from '../../../common/auth/principal';

const RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

type Checked = { row: ParsedRow; value: ProductImportRow } | { row: ParsedRow; error: string };

/** The first schema message of a refused row, e.g. "Sale price: amount must have …". */
function check(row: ParsedRow): Checked {
  const parsed = productImportRowSchema.safeParse(row.cells);
  return parsed.success
    ? { row, value: parsed.data }
    : { row, error: parsed.error.issues[0]?.message ?? 'Invalid row' };
}

/**
 * Upload → staged job (SYSTEM_DESIGN.md §7, ADR-020): every row is validated now, so the worker
 * only applies good rows. A barcode repeated in the file and an unknown category (Q37: imports
 * never create categories) fail their row. The job is stored before it is queued, so a Redis
 * outage leaves it `QUEUED` until Redis is back (RED-08).
 */
@Injectable()
export class ImportStagingService {
  constructor(
    private readonly jobs: ImportJobsRepository,
    private readonly products: ProductImportService,
    private readonly queue: ImportQueue,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly uow: UnitOfWork,
  ) {}

  async stage(fileName: string, bytes: Buffer, viewer: Principal) {
    const checked = (await parseImportFile(fileName, bytes)).map(check);
    const names = checked.flatMap((c) =>
      'value' in c && c.value.categoryName !== null ? [c.value.categoryName] : [],
    );
    const categories = await this.products.categoryIds([...new Set(names)]);
    const firstLine = new Map<string, number>();
    const staged = checked.map((entry): StagedRow => {
      if ('error' in entry) return this.failed(entry.row, entry.error);
      const { categoryName, ...fields } = entry.value;
      const categoryId = categoryName === null ? null : categories.get(categoryName.toLowerCase());
      if (categoryId === undefined)
        return this.failed(entry.row, `Unknown category "${categoryName ?? ''}"`);
      if (fields.barcode !== null) {
        const earlier = firstLine.get(fields.barcode);
        if (earlier !== undefined)
          return this.failed(entry.row, `Barcode repeats line ${String(earlier)}`);
        firstLine.set(fields.barcode, entry.row.rowNumber);
      }
      const data: ImportedProduct = { ...fields, categoryId };
      return {
        rowNumber: entry.row.rowNumber,
        data,
        status: 'PENDING',
        error: null,
      };
    });
    const job = await this.uow.run(async () => {
      await this.jobs.deleteOldRows(new Date(this.clock.now().getTime() - RETENTION_DAYS * DAY_MS));
      const created = await this.jobs.create(fileName.slice(0, 200), viewer.userId, staged);
      await this.audit.record('catalog.importStarted', viewer.userId, {
        entityType: 'importJob',
        entityId: created.id,
        metadata: { rows: created.totalRows, refused: created.failedRows },
      });
      return created;
    });
    await this.queue.enqueue(job.id);
    return job;
  }

  private failed(row: ParsedRow, error: string): StagedRow {
    return {
      rowNumber: row.rowNumber,
      data: row.cells,
      status: 'FAILED',
      error: error.slice(0, 300),
    };
  }
}
