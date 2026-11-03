import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { ImportQueriesService } from '../application/import-queries.service';

import { ImportJob, ImportJobRowConnection, ImportJobRowsArgs } from './import-job.types';

import type { Principal } from '../../../common/auth/principal';

/** Import progress and its row report (F-11); uploads themselves are REST (API.md §9). */
@Resolver(() => ImportJob)
export class ImportJobsResolver {
  constructor(private readonly queries: ImportQueriesService) {}

  @Query(() => ImportJob, { nullable: true, description: 'Imports you started.' })
  @RequirePermission('catalog:import')
  importJob(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ) {
    return this.queries.job(id, viewer);
  }

  @Query(() => ImportJobRowConnection, { description: 'Spreadsheet order; filter by status.' })
  @RequirePermission('catalog:import')
  importJobRows(
    @Args(new ZodValidationPipe(schemas.importJobRowsArgsSchema)) args: ImportJobRowsArgs,
    @CurrentViewer() viewer: Principal,
  ) {
    return this.queries.rows(args, viewer); // the pipe returned the parsed, defaulted args
  }
}
