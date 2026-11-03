import { openSecret, sealSecret } from '../infrastructure/crypto/secret-box';

import type { AppPrismaClient } from '../infrastructure/prisma/prisma.module';

export type ReencryptOutcome = 'no-key' | 'already-current' | 'reencrypted';

/**
 * Re-encrypts the stored Groq key from the previous `SETTINGS_ENCRYPTION_KEY` to the current one
 * (DEPLOYMENT.md §10, `docs/runbooks/rotate-secrets.md`), in one transaction with the row locked.
 * Safe to run twice: a key that already opens under the current key is left alone. The key itself
 * is never printed or audited; `last4` is unchanged.
 */
export async function reencryptGroqKey(
  client: AppPrismaClient,
  previousKey: Buffer,
  currentKey: Buffer,
): Promise<ReencryptOutcome> {
  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ ciphertext: Uint8Array | null }[]>`
      SELECT groq_api_key_ciphertext AS ciphertext FROM shop_settings WHERE id = 1 FOR UPDATE`;
    const sealed = rows[0]?.ciphertext ?? null;
    if (sealed === null) {
      return 'no-key';
    }
    if (opens(currentKey, sealed)) {
      return 'already-current';
    }
    const plaintext = openSecret(previousKey, sealed); // throws: neither key opens it
    await tx.shopSettings.update({
      where: { id: 1 },
      data: { groqApiKeyCiphertext: sealSecret(currentKey, plaintext) },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: { action: 'settings.aiKeyReencrypted', entityType: 'settings', entityId: '1' },
      select: { id: true },
    });
    return 'reencrypted';
  });
}

function opens(key: Buffer, sealed: Uint8Array): boolean {
  try {
    openSecret(key, sealed);
    return true;
  } catch {
    return false;
  }
}
