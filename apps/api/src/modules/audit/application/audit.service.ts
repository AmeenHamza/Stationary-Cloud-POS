import { Injectable } from '@nestjs/common';

import { RequestContext } from '../../../common/http/request-context';
import { AuditRepository } from '../persistence/audit.repository';

import type { AuditAction } from './audit-actions';
import type { Prisma } from '@pos/database';

export interface AuditDetails {
  entityType?: string;
  entityId?: string;
  /** Changed fields or context. Never passwords, tokens, keys or customer PII (SYSTEM_DESIGN.md §9.4). */
  metadata?: Prisma.InputJsonObject;
}

/**
 * The audit writer (SYSTEM_DESIGN.md §9.3). Call it inside the use case's `UnitOfWork.run()` so the
 * audit row commits or rolls back with the change it describes. IP and request id come from CLS.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly request: RequestContext,
  ) {}

  async record(
    action: AuditAction,
    actorUserId: string | null,
    details: AuditDetails = {},
  ): Promise<void> {
    const client = this.request.client();
    await this.repository.insert({
      actorUserId,
      action,
      entityType: details.entityType ?? null,
      entityId: details.entityId ?? null,
      metadata: details.metadata ?? null,
      ip: client.ip,
      requestId: client.requestId,
    });
  }
}
