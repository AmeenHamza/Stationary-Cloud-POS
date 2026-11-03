import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../config/app-config';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** A `SETTINGS_ENCRYPTION_KEY` value (base64 of 32 bytes) as key bytes; anything else throws. */
export function encryptionKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error('the encryption key must be base64 of exactly 32 bytes');
  }
  return key;
}

/** nonce ‖ ciphertext ‖ tag under `key` (DATABASE.md §4.3), with a fresh nonce each time. */
export function sealSecret(key: Buffer, plaintext: string): Uint8Array<ArrayBuffer> {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return new Uint8Array(Buffer.concat([nonce, body, cipher.getAuthTag()]));
}

/** The plaintext of a sealed value; throws if it was sealed under another key or altered. */
export function openSecret(key: Buffer, sealed: Uint8Array): string {
  const bytes = Buffer.from(sealed);
  if (bytes.length <= NONCE_BYTES + TAG_BYTES) {
    throw new Error('sealed value is too short');
  }
  const decipher = createDecipheriv(ALGORITHM, key, bytes.subarray(0, NONCE_BYTES));
  decipher.setAuthTag(bytes.subarray(bytes.length - TAG_BYTES));
  const body = bytes.subarray(NONCE_BYTES, bytes.length - TAG_BYTES);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/**
 * AES-256-GCM for secrets stored in PostgreSQL, i.e. the Groq key (SYSTEM_DESIGN.md §9.1), under
 * `SETTINGS_ENCRYPTION_KEY`. Rotating that key re-encrypts with `cli/rotate-settings-key.ts`.
 */
@Injectable()
export class SecretBox {
  private readonly key: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.key = encryptionKey(config.SETTINGS_ENCRYPTION_KEY);
  }

  seal(plaintext: string): Uint8Array<ArrayBuffer> {
    return sealSecret(this.key, plaintext);
  }

  open(sealed: Uint8Array): string {
    return openSecret(this.key, sealed);
  }
}
