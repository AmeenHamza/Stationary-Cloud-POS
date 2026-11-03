import { Module } from '@nestjs/common';

import { QueueModule } from '../../infrastructure/queue/queue.module';
import { AuditModule } from '../audit';
import { CatalogModule } from '../catalog';

import { ImportEvents } from './application/import-events';
import { ImportQueriesService } from './application/import-queries.service';
import { ImportQueue } from './application/import-queue';
import { ImportRunner } from './application/import-runner.service';
import { ImportStagingService } from './application/import-staging.service';
import { ImportJobsResolver } from './graphql/import-jobs.resolver';
import { ExportsController } from './http/exports.controller';
import { ImportsController } from './http/imports.controller';
import { ImportJobsRepository } from './persistence/import-jobs.repository';

/**
 * Product import (BullMQ, ADR-020) and file exports (F-11, F-13). Product writes go through the
 * catalogue's `ProductImportService`; exports read through its `ProductExportReader`.
 */
@Module({
  imports: [AuditModule, CatalogModule, QueueModule],
  controllers: [ImportsController, ExportsController],
  providers: [
    ImportJobsResolver,
    ImportQueriesService,
    ImportStagingService,
    ImportQueue,
    ImportRunner,
    ImportEvents,
    ImportJobsRepository,
  ],
})
export class CatalogIoModule {}
