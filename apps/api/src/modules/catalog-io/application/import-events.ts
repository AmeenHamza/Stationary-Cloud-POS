import { Injectable } from '@nestjs/common';

import { userAudience } from '../../../infrastructure/realtime/channels';
import { OutboxService } from '../../../infrastructure/realtime/outbox.service';

import type { ImportJobRow } from '../persistence/import-jobs.repository';

/** `import.progressed` to the importing admin only (API.md §7.2), in the batch's transaction. */
@Injectable()
export class ImportEvents {
  constructor(private readonly outbox: OutboxService) {}

  async progressed(job: ImportJobRow): Promise<void> {
    await this.outbox.add('import.progressed', userAudience(job.createdById), {
      importJobId: job.id,
      status: job.status,
      processedRows: job.processedRows,
      totalRows: job.totalRows,
      succeededRows: job.succeededRows,
      failedRows: job.failedRows,
    });
  }
}
