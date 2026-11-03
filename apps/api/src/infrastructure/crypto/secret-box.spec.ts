import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { SecretBox } from './secret-box';

import type { AppConfig } from '../../config/app-config';

const boxWithNewKey = (): SecretBox =>
  new SecretBox({ SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('base64') } as AppConfig);

describe('SecretBox (AES-256-GCM, SYSTEM_DESIGN.md §9.1)', () => {
  it('opens what it sealed, with a fresh nonce each time and no plaintext in the bytes', () => {
    const box = boxWithNewKey();
    const secret = 'gsk_example_not_a_real_key_0123456789';
    const first = box.seal(secret);
    const second = box.seal(secret);
    expect(box.open(first)).toBe(secret);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
    expect(Buffer.from(first).toString('latin1')).not.toContain('gsk_');
    expect(first.length).toBe(12 + secret.length + 16);
  });

  it('refuses altered bytes, another key and truncated values', () => {
    const box = boxWithNewKey();
    const sealed = box.seal('secret value');
    const altered = new Uint8Array(sealed);
    altered[14] = (altered[14] ?? 0) ^ 0xff;
    expect(() => box.open(altered)).toThrow();
    expect(() => boxWithNewKey().open(sealed)).toThrow();
    expect(() => box.open(sealed.subarray(0, 20))).toThrow('too short');
  });
});
