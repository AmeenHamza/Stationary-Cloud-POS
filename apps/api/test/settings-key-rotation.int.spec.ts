import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { reencryptGroqKey } from '../src/cli/reencrypt-groq-key';
import { encryptionKey, openSecret } from '../src/infrastructure/crypto/secret-box';

import { CLEAR_KEY, SET_KEY, newTestKey } from './support/ai';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const previous = randomBytes(32).toString('base64');
const t = useRoles({ env: () => ({ SETTINGS_ENCRYPTION_KEY: previous }) });

const stored = () =>
  t.prisma.shopSettings.findUniqueOrThrow({
    where: { id: 1 },
    select: { groqApiKeyCiphertext: true, groqApiKeyLast4: true },
  });

describe('SETTINGS_ENCRYPTION_KEY rotation (DEPLOYMENT.md §10, F-30)', () => {
  it('re-encrypts the Groq key under the new key once, keeps last4 and audits without metadata', async () => {
    const groqKey = newTestKey();
    await asUser(t.h.url, t.admin, SET_KEY, { input: { apiKey: groqKey } });
    const next = encryptionKey(randomBytes(32).toString('base64'));

    expect(await reencryptGroqKey(t.prisma, encryptionKey(previous), next)).toBe('reencrypted');
    const row = await stored();
    expect(row.groqApiKeyLast4).toBe(groqKey.slice(-4));
    expect(openSecret(next, row.groqApiKeyCiphertext ?? new Uint8Array())).toBe(groqKey);
    expect(() =>
      openSecret(encryptionKey(previous), row.groqApiKeyCiphertext ?? new Uint8Array()),
    ).toThrow();
    const audit = await t.prisma.auditLog.findMany({
      where: { action: 'settings.aiKeyReencrypted' },
      select: { metadata: true },
      take: 5,
    });
    expect(audit).toEqual([{ metadata: null }]);

    expect(await reencryptGroqKey(t.prisma, encryptionKey(previous), next)).toBe('already-current');
  });

  it('refuses when neither key opens the stored value, and changes nothing', async () => {
    const before = await stored();
    const stranger = () => encryptionKey(randomBytes(32).toString('base64'));
    await expect(reencryptGroqKey(t.prisma, stranger(), stranger())).rejects.toThrow();
    expect(await stored()).toEqual(before);
  });

  it('has nothing to do when no key is stored', async () => {
    await asUser(t.h.url, t.admin, CLEAR_KEY);
    const key = encryptionKey(randomBytes(32).toString('base64'));
    expect(await reencryptGroqKey(t.prisma, key, key)).toBe('no-key');
  });
});
