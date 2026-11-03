import { Controller, Get, Query, Res } from '@nestjs/common';

import {
  lowStockExportQuerySchema,
  productExportQuerySchema,
  type ProductExportQuery,
} from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ClockService } from '../../../common/time/clock.service';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';
import { AuditService } from '../../audit';
import { ProductExportReader } from '../../catalog';
import { LOW_STOCK_COLUMNS, PRODUCT_COLUMNS } from '../application/export-columns';

import { sendSheet } from './download';

import type { Principal } from '../../../common/auth/principal';
import type { Response } from 'express';

/**
 * File exports (F-11, F-13; API.md §9): explicit, rate-limited (`export`, 20/hour), audited
 * downloads, read in keyset batches of 500 and streamed, so memory stays flat at any size.
 */
@Controller('v1/exports')
export class ExportsController {
  constructor(
    private readonly reader: ProductExportReader,
    private readonly limiter: RateLimiterService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  @Get('products')
  @RequirePermission('catalog:export')
  async products(
    @Query(new ZodValidationPipe(productExportQuerySchema)) query: ProductExportQuery,
    @CurrentViewer() viewer: Principal,
    @Res() res: Response,
  ): Promise<void> {
    await this.start(viewer, 'products', query.format);
    const batches = this.reader.batches({
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      includeArchived: query.includeArchived,
    });
    await sendSheet(res, query.format, `products-${this.clock.businessDate()}`, {
      title: 'Products',
      columns: PRODUCT_COLUMNS,
      batches,
    });
  }

  @Get('low-stock')
  @RequirePermission('catalog:export')
  async lowStock(
    @Query(new ZodValidationPipe(lowStockExportQuerySchema)) query: { format: 'csv' | 'pdf' },
    @CurrentViewer() viewer: Principal,
    @Res() res: Response,
  ): Promise<void> {
    await this.start(viewer, 'low-stock', query.format);
    await sendSheet(res, query.format, `low-stock-${this.clock.businessDate()}`, {
      title: 'Low stock',
      columns: LOW_STOCK_COLUMNS,
      batches: this.reader.batches({ lowStockOnly: true }),
    });
  }

  private async start(viewer: Principal, list: string, format: string): Promise<void> {
    await this.limiter.consume('export', viewer.userId);
    await this.audit.record('catalog.exported', viewer.userId, {
      entityType: 'product',
      metadata: { list, format },
    });
  }
}
