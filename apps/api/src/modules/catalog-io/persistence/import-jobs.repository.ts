import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { ImportRowStatus, ImportStatus } from '@pos/contracts';
import type { Prisma } from '@pos/database';

export const IMPORT_JOB_SELECT = {
  id: true,
  status: true,
  fileName: true,
  totalRows: true,
  processedRows: true,
  succeededRows: true,
  failedRows: true,
  createdById: true,
  createdAt: true,
  finishedAt: true,
  errorSummary: true,
} as const satisfies Prisma.ImportJobSelect;

export type ImportJobRow = Prisma.ImportJobGetPayload<{ select: typeof IMPORT_JOB_SELECT }>;

/** A staged row: its spreadsheet line, the parsed data, or the reason it was refused. */
export interface StagedRow {
  rowNumber: number;
  data: Prisma.InputJsonValue;
  status: Extract<ImportRowStatus, 'PENDING' | 'FAILED'>;
  error: string | null;
}

/** Import jobs and their staged rows (DATABASE.md §4.15). */
@Injectable()
export class ImportJobsRepository {
  constructor(private readonly db: TransactionalClient) {}

  async create(fileName: string, createdById: string, rows: readonly StagedRow[]) {
    const failed = rows.filter((row) => row.status === 'FAILED').length;
    const job = await this.db.client.importJob.create({
      data: {
        kind: 'PRODUCTS',
        fileName,
        totalRows: rows.length,
        createdById,
        processedRows: failed,
        failedRows: failed,
      },
      select: IMPORT_JOB_SELECT,
    });
    await this.db.client.importJobRow.createMany({
      data: rows.map((row) => ({ ...row, jobId: job.id })),
    });
    return job;
  }

  findById(id: string): Promise<ImportJobRow | null> {
    return this.db.client.importJob.findUnique({ where: { id }, select: IMPORT_JOB_SELECT });
  }

  queuedIds(): Promise<{ id: string }[]> {
    return this.db.client.importJob.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  setStatus(id: string, status: ImportStatus, at: Date, errorSummary: string | null = null) {
    const finished = status === 'COMPLETED' || status === 'FAILED';
    return this.db.client.importJob.update({
      where: { id },
      data: {
        status,
        errorSummary,
        ...(status === 'RUNNING' ? { startedAt: at } : {}),
        ...(finished ? { finishedAt: at } : {}),
      },
      select: IMPORT_JOB_SELECT,
    });
  }

  /** The next pending rows in spreadsheet order. */
  pending(jobId: string, take: number) {
    return this.db.client.importJobRow.findMany({
      where: { jobId, status: 'PENDING' },
      orderBy: { rowNumber: 'asc' },
      take,
      select: { id: true, rowNumber: true, data: true },
    });
  }

  markRow(id: bigint, outcome: { productId: string } | { error: string }) {
    return this.db.client.importJobRow.update({
      where: { id },
      data:
        'productId' in outcome
          ? { status: 'SUCCEEDED', productId: outcome.productId }
          : { status: 'FAILED', error: outcome.error.slice(0, 300) },
      select: { id: true },
    });
  }

  /** Adds a batch's results to the job's counters (one statement, concurrent-safe). */
  count(jobId: string, succeeded: number, failed: number) {
    return this.db.client.importJob.update({
      where: { id: jobId },
      data: {
        processedRows: { increment: succeeded + failed },
        succeededRows: { increment: succeeded },
        failedRows: { increment: failed },
      },
      select: IMPORT_JOB_SELECT,
    });
  }

  /** A page of rows after spreadsheet line `afterRow` (row numbers are unique within a job). */
  rows(jobId: string, status: ImportRowStatus | null, take: number, afterRow: number | null) {
    return this.db.client.importJobRow.findMany({
      where: {
        jobId,
        ...(status === null ? {} : { status }),
        ...(afterRow === null ? {} : { rowNumber: { gt: afterRow } }),
      },
      orderBy: { rowNumber: 'asc' },
      take,
      select: { rowNumber: true, status: true, error: true, productId: true, data: true },
    });
  }

  countRows(jobId: string, status: ImportRowStatus | null): Promise<number> {
    return this.db.client.importJobRow.count({
      where: { jobId, ...(status === null ? {} : { status }) },
    });
  }

  /** Retention (DATABASE.md §4.15): rows of jobs finished more than 30 days ago. */
  deleteOldRows(before: Date) {
    return this.db.client.importJobRow.deleteMany({
      where: { job: { finishedAt: { lt: before } } },
    });
  }
}
