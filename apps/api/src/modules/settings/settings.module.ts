import { Module } from '@nestjs/common';

import { CryptoModule } from '../../infrastructure/crypto/crypto.module';
import { AuditModule } from '../audit';

import { AiKeyService } from './application/ai-key.service';
import { SettingsService } from './application/settings.service';
import { AiKeyResolver } from './graphql/ai-key.resolver';
import { SettingsResolver } from './graphql/settings.resolver';
import { AiKeyRepository } from './persistence/ai-key.repository';
import { SettingsRepository } from './persistence/settings.repository';

/** Shop profile and default Bill GST (Q26), and the encrypted Groq key (F-30). */
@Module({
  imports: [AuditModule, CryptoModule],
  providers: [
    SettingsResolver,
    SettingsService,
    SettingsRepository,
    AiKeyResolver,
    AiKeyService,
    AiKeyRepository,
  ],
  exports: [SettingsService, AiKeyService],
})
export class SettingsModule {}
