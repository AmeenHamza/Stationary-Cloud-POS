import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { Prisma } from '@pos/database';

export interface AuditRow {
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Prisma.InputJsonValue | null;
  ip: string | null;
  requestId: string | null;
}

/** Persistence for `audit_logs` (DATABASE.md §4.14). Writes join the caller's transaction. */
@Injectable()
export class AuditRepository {
  constructor(private readonly db: TransactionalClient) {}

  async insert(row: AuditRow): Promise<void> {
    await this.db.client.auditLog.create({
      data: {
        actorUserId: row.actorUserId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        ip: row.ip,
        requestId: row.requestId,
        ...(row.metadata === null ? {} : { metadata: row.metadata }),
      },
      select: { id: true },
    });
  }
}
