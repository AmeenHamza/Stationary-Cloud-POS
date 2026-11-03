import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { decodeCursor, encodeCursor } from '../../../common/pagination/cursor.codec';
import { ImportJobsRepository } from '../persistence/import-jobs.repository';

import type { Principal } from '../../../common/auth/principal';
import type { ImportJobRowsArgs } from '@pos/validation';

const ROWS = 'ROW_ASC';

/** `importJob` and `importJobRows` (API.md §6): an admin sees only the imports they started. */
@Injectable()
export class ImportQueriesService {
  constructor(private readonly jobs: ImportJobsRepository) {}

  async job(id: string, viewer: Principal) {
    const job = await this.jobs.findById(id);
    return job !== null && job.createdById === viewer.userId ? job : null;
  }

  async rows(args: ImportJobRowsArgs, viewer: Principal) {
    if ((await this.job(args.jobId, viewer)) === null) {
      throw new AppError('NOT_FOUND', 'This import does not exist.');
    }
    const afterRow =
      args.after == null ? null : Number.parseInt(String(decodeCursor(args.after, ROWS).key), 10);
    const rows = await this.jobs.rows(args.jobId, args.status ?? null, args.first + 1, afterRow);
    const page = rows.slice(0, args.first);
    const last = page.at(-1);
    return {
      nodes: page.map((row) => ({ ...row, id: `${args.jobId}:${String(row.rowNumber)}` })),
      pageInfo: {
        hasNextPage: rows.length > args.first,
        endCursor:
          last === undefined ? null : encodeCursor(ROWS, last.rowNumber, String(last.rowNumber)),
      },
      loadTotalCount: () => this.jobs.countRows(args.jobId, args.status ?? null),
    };
  }
}
