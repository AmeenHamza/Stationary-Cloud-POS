import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** argon2id (the library default) with OWASP's minimum: 19 MiB memory, 2 passes, 1 lane. */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Password hashing (ADR-031). Only PHC strings are stored; plain passwords never leave this class. */
@Injectable()
export class PasswordHasher {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false; // malformed hash: treat as a failed check, never as an error
    }
  }

  /** Same work as a real check for unknown usernames, so timing does not reveal which exist. */
  async verifyUnknownUser(password: string): Promise<false> {
    this.dummyHash ??= this.hash(randomBytes(16).toString('hex'));
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
