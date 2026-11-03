import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { stringify } from 'csv-stringify';

import { IMPORT_MAX_BYTES } from '@pos/contracts';
import { idSchema } from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { AppError } from '../../../common/errors/app-error';
import { CsrfHeaderGuard } from '../../../common/http/csrf-header.guard';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';
import { safeText } from '../application/export-columns';
import { ImportQueriesService } from '../application/import-queries.service';
import { ImportStagingService } from '../application/import-staging.service';
import { writeTemplate } from '../application/import-template';
import { ImportJobsRepository } from '../persistence/import-jobs.repository';

import type { Principal } from '../../../common/auth/principal';
import type { Response } from 'express';

interface Upload {
  originalname: string;
  buffer: Buffer;
}

/** Product import over REST (F-11, API.md §9): upload, template and the failed-rows report. */
@Controller('v1/imports')
export class ImportsController {
  constructor(
    private readonly staging: ImportStagingService,
    private readonly queries: ImportQueriesService,
    private readonly jobs: ImportJobsRepository,
    private readonly limiter: RateLimiterService,
  ) {}

  /** `202 { importJobId }`: rows are validated and stored, the work continues in the queue. */
  @Post('products')
  @HttpCode(202)
  @RequirePermission('catalog:import')
  @UseGuards(CsrfHeaderGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES, files: 1 } }))
  async upload(@UploadedFile() file: Upload | undefined, @CurrentViewer() viewer: Principal) {
    if (file === undefined) {
      throw new AppError('BAD_USER_INPUT', 'Choose a file to import.', {
        fieldErrors: { file: 'Choose a file to import' },
      });
    }
    await this.limiter.consume('import', viewer.userId);
    const job = await this.staging.stage(file.originalname, file.buffer, viewer);
    return { importJobId: job.id };
  }

  @Get('products/template.xlsx')
  @RequirePermission('catalog:import')
  async template(@Res() res: Response): Promise<void> {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.xlsx"');
    await writeTemplate(res);
  }

  /** The refused rows with their reasons, in spreadsheet order, streamed in pages of 500. */
  @Get(':jobId/errors.csv')
  @RequirePermission('catalog:import')
  async errors(
    @Param('jobId', new ZodValidationPipe(idSchema)) jobId: string,
    @CurrentViewer() viewer: Principal,
    @Res() res: Response,
  ): Promise<void> {
    if ((await this.queries.job(jobId, viewer)) === null) {
      throw new AppError('NOT_FOUND', 'This import does not exist.');
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="import-errors.csv"');
    const csv = stringify({ bom: true });
    csv.pipe(res);
    csv.write(['Line', 'Barcode', 'Name', 'Error']);
    let afterRow: number | null = null;
    for (;;) {
      const rows = await this.jobs.rows(jobId, 'FAILED', 500, afterRow);
      for (const row of rows) {
        const data = (row.data ?? {}) as { barcode?: string | null; name?: string | null };
        csv.write([
          row.rowNumber,
          safeText(data.barcode ?? null),
          safeText(data.name ?? null),
          row.error,
        ]);
      }
      afterRow = rows.at(-1)?.rowNumber ?? null;
      if (rows.length < 500 || afterRow === null) break;
    }
    csv.end();
  }
}
