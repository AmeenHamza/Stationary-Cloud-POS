import { Module } from '@nestjs/common';

import { GroqClient } from './groq.client';

/** The Groq chat client for the AI Assistant (ADR-026). */
@Module({
  providers: [GroqClient],
  exports: [GroqClient],
})
export class GroqModule {}
