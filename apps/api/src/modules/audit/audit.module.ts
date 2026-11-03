import { Module } from '@nestjs/common';

import { AuditService } from './application/audit.service';
import { AuditRepository } from './persistence/audit.repository';

/** Audit writer used by every module that changes data (ARCHITECTURE.md §7.1). */
@Module({
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
