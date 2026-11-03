import { Module } from '@nestjs/common';

import { SecretBox } from './secret-box';

/** Encryption of stored secrets (Phase 12: the Groq key). */
@Module({
  providers: [SecretBox],
  exports: [SecretBox],
})
export class CryptoModule {}
