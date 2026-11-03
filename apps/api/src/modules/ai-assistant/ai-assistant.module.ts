import { Module } from '@nestjs/common';

import { GroqModule } from '../../infrastructure/ai/groq.module';
import { AuditModule } from '../audit';
import { ReportingModule } from '../reporting';
import { SettingsModule } from '../settings';

import { AiChatService } from './application/ai-chat.service';
import { AiFactsService } from './application/ai-facts.service';
import { AiReportsService } from './application/ai-reports.service';
import { AiRequestService } from './application/ai-request.service';
import { AiResultCache } from './application/ai-result-cache';
import { AiTools } from './application/ai-tools';
import { AiResolver } from './graphql/ai.resolver';

/**
 * AI Assistant (D-22, ADR-026): six admin-only features over Groq. Reads bounded aggregates from
 * `reporting`, the key from `settings`; writes only the `ai.requested` audit row.
 */
@Module({
  imports: [AuditModule, GroqModule, ReportingModule, SettingsModule],
  providers: [
    AiResolver,
    AiReportsService,
    AiChatService,
    AiRequestService,
    AiFactsService,
    AiResultCache,
    AiTools,
  ],
})
export class AiAssistantModule {}
