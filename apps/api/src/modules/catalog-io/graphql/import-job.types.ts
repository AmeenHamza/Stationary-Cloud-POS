import { ArgsType, Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

import { ImportRowStatusEnum, ImportStatusEnum } from '../../../common/graphql/enums.registry';
import { ShopEvent } from '../../../common/graphql/shop-event.interface';
import { Connection } from '../../../common/pagination/connection.factory';

import type { ImportRowStatus, ImportStatus } from '@pos/contracts';

/** A product import (F-11): its progress and outcome (DATABASE.md §4.15). */
@ObjectType('ImportJob')
export class ImportJob {
  @Field(() => ID)
  id!: string;

  @Field(() => ImportStatusEnum)
  status!: ImportStatus;

  @Field(() => String)
  fileName!: string;

  @Field(() => Int)
  totalRows!: number;

  @Field(() => Int)
  processedRows!: number;

  @Field(() => Int)
  succeededRows!: number;

  @Field(() => Int)
  failedRows!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;

  @Field(() => String, { nullable: true })
  errorSummary!: string | null;
}

/** One spreadsheet line: applied, refused (with the reason) or still waiting. */
@ObjectType('ImportJobRow')
export class ImportJobRow {
  @Field(() => ID, { description: 'Job id and spreadsheet line, e.g. "<job>:12".' })
  id!: string;

  @Field(() => Int, { description: 'Spreadsheet line, 2 = first data row.' })
  rowNumber!: number;

  @Field(() => ImportRowStatusEnum)
  status!: ImportRowStatus;

  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => ID, { nullable: true })
  productId!: string | null;
}

@ObjectType('ImportJobRowConnection')
export class ImportJobRowConnection extends Connection(ImportJobRow) {}

@ArgsType()
export class ImportJobRowsArgs {
  @Field(() => ID)
  jobId!: string;

  @Field(() => ImportRowStatusEnum, { nullable: true })
  status?: ImportRowStatus | null;

  @Field(() => Int, { defaultValue: 50 })
  first!: number;

  @Field(() => String, { nullable: true })
  after?: string | null;
}

/** `import.progressed` (the importing admin only): patch the job's counters. */
@ObjectType('ImportProgressedEvent', { implements: () => [ShopEvent] })
export class ImportProgressedEvent extends ShopEvent {
  @Field(() => ID)
  importJobId!: string;

  @Field(() => ImportStatusEnum)
  status!: ImportStatus;

  @Field(() => Int)
  processedRows!: number;

  @Field(() => Int)
  totalRows!: number;

  @Field(() => Int)
  succeededRows!: number;

  @Field(() => Int)
  failedRows!: number;
}

/** `catalog.bulkChanged` (staff): product and category lists are read again once. */
@ObjectType('CatalogBulkChangedEvent', { implements: () => [ShopEvent] })
export class CatalogBulkChangedEvent extends ShopEvent {
  @Field(() => String, { description: 'IMPORT.' })
  reason!: string;

  @Field(() => ID)
  importJobId!: string;

  @Field(() => Int)
  changedCount!: number;
}
