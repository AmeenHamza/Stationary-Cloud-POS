import { Injectable } from '@nestjs/common';

import { AI_MAX_TOOL_ROUNDS } from '@pos/contracts';

import { GroqClient, type ChatMessage } from '../../../infrastructure/ai/groq.client';

import {
  AiRequestService,
  answerText,
  type AiResultValue,
  type Generated,
} from './ai-request.service';
import { AI_TOOLS, AiTools } from './ai-tools';
import { systemPrompt } from './prompt-builder';

import type { Principal } from '../../../common/auth/principal';
import type { AiAskInput } from '@pos/validation';

/**
 * "Ask Your POS" (F-29, SYSTEM_DESIGN.md §8 step 6): the model may call the read-only tools for up
 * to three rounds, then must answer. The history comes from the client and is never stored.
 */
@Injectable()
export class AiChatService {
  constructor(
    private readonly requests: AiRequestService,
    private readonly groq: GroqClient,
    private readonly tools: AiTools,
  ) {}

  ask(input: AiAskInput, viewer: Principal): Promise<AiResultValue> {
    return this.requests.run(viewer, {
      feature: 'ASK',
      language: input.language,
      inputs: { question: input.question, history: input.history },
      generate: ({ apiKey, today }) => this.converse(input, apiKey, today),
    });
  }

  private async converse(input: AiAskInput, apiKey: string, today: string): Promise<Generated> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt('ASK', input.language, today) },
      ...input.history.map((turn): ChatMessage =>
        turn.role === 'USER'
          ? { role: 'user', content: turn.text }
          : { role: 'assistant', content: turn.text },
      ),
      { role: 'user', content: input.question },
    ];
    let promptTokens = 0;
    let completionTokens = 0;
    for (let round = 0; ; round += 1) {
      const lastRound = round === AI_MAX_TOOL_ROUNDS;
      const reply = await this.groq.chat({
        apiKey,
        messages,
        tools: AI_TOOLS,
        allowTools: !lastRound,
      });
      promptTokens += reply.promptTokens;
      completionTokens += reply.completionTokens;
      const calls = reply.message.tool_calls ?? [];
      if (calls.length === 0 || lastRound) {
        const text = answerText(reply.message.content);
        return { text, promptTokens, completionTokens, toolRounds: round };
      }
      messages.push({ role: 'assistant', content: reply.message.content, tool_calls: calls });
      for (const call of calls) {
        const content = await this.tools.run(call.function.name, call.function.arguments, today);
        messages.push({ role: 'tool', tool_call_id: call.id, content });
      }
    }
  }
}
