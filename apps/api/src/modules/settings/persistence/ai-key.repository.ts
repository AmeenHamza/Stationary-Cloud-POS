import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

export interface AiKeyStatusRow {
  /** Set together with the ciphertext (`shop_settings_ai_key_ck`), so it alone says "configured". */
  groqApiKeyLast4: string | null;
}

/**
 * The Groq key columns of `shop_settings` (DATABASE.md §4.3). Only `ciphertext()` reads the secret,
 * for the AI Assistant; nothing else selects it, so it never reaches a response or the cache.
 */
@Injectable()
export class AiKeyRepository {
  constructor(private readonly db: TransactionalClient) {}

  status(): Promise<AiKeyStatusRow> {
    return this.db.client.shopSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: { groqApiKeyLast4: true },
    });
  }

  async ciphertext(): Promise<Uint8Array | null> {
    const row = await this.db.client.shopSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: { groqApiKeyCiphertext: true },
    });
    return row.groqApiKeyCiphertext;
  }

  /** Stores (or clears, with nulls) the key; returns the settings version for the event. */
  async save(
    ciphertext: Uint8Array<ArrayBuffer> | null,
    last4: string | null,
    actorUserId: string,
  ): Promise<number> {
    const row = await this.db.client.shopSettings.update({
      where: { id: 1 },
      data: { groqApiKeyCiphertext: ciphertext, groqApiKeyLast4: last4, updatedById: actorUserId },
      select: { version: true },
    });
    return row.version;
  }
}
