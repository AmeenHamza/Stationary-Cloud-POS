import { Global, Module } from '@nestjs/common';

import { TransactionalClient } from '../prisma/transactional-client';

import { AfterCommit } from './after-commit';
import { UnitOfWork } from './unit-of-work';

@Global()
@Module({
  providers: [UnitOfWork, AfterCommit, TransactionalClient],
  exports: [UnitOfWork, AfterCommit, TransactionalClient],
})
export class UnitOfWorkModule {}
