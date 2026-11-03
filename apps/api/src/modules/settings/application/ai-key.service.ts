import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SecretBox } from '../../../infrastructure/crypto/secret-box';
import { OutboxService } from '../../../infrastructure/realtime/outbox.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService, type AuditAction } from '../../audit';
import { AiKeyRepository } from '../persistence/ai-key.repository';

import type { Principal } from '../../../common/auth/principal';

export interface AiKeyStatus {
  configured: boolean;
  last4: string | null;
}

/**
 * The shop's Groq key (F-30, SYSTEM_DESIGN.md §9.1): stored AES-256-GCM encrypted, shown only as its
 * last 4 characters, never returned, logged or audited. Other admin screens learn of a change from
 * `settings.changed`.
 */
@Injectable()
export class AiKeyService {
  constructor(
    private readonly keys: AiKeyRepository,
    private readonly box: SecretBox,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  async status(): Promise<AiKeyStatus> {
    const row = await this.keys.status();
    return { configured: row.groqApiKeyLast4 !== null, last4: row.groqApiKeyLast4 };
  }

  set(apiKey: string, viewer: Principal): Promise<void> {
    return this.save(this.box.seal(apiKey), apiKey.slice(-4), 'settings.aiKeySet', viewer);
  }

  clear(viewer: Principal): Promise<void> {
    return this.save(null, null, 'settings.aiKeyCleared', viewer);
  }

  /** The decrypted key for one AI request (never cached, SYSTEM_DESIGN.md §8 step 1). */
  async apiKey(): Promise<string> {
    const sealed = await this.keys.ciphertext();
    if (sealed === null) {
      throw new AppError(
        'AI_NOT_CONFIGURED',
        'Add the Groq API key in Settings to use the AI Assistant.',
      );
    }
    try {
      return this.box.open(sealed);
    } catch {
      throw new AppError(
        'AI_NOT_CONFIGURED',
        'The saved Groq API key can no longer be read. Enter it again in Settings.',
      );
    }
  }

  private async save(
    sealed: Uint8Array<ArrayBuffer> | null,
    last4: string | null,
    action: AuditAction,
    viewer: Principal,
  ): Promise<void> {
    await this.uow.run(async () => {
      const version = await this.keys.save(sealed, last4, viewer.userId);
      await this.outbox.add('settings.changed', 'staff', { version });
      await this.audit.record(action, viewer.userId, { entityType: 'settings', entityId: '1' });
    });
  }
}
