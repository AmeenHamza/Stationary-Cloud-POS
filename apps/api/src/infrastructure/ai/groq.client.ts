import { Inject, Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';

import { AppError } from '../../common/errors/app-error';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'groq-sdk/resources/chat/completions';

export type { ChatCompletionMessageParam as ChatMessage, ChatCompletionTool as ChatTool };

/** U-05 default: a Groq production model with tool use and published pricing (ADR-041). */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

const TIMEOUT_MS = 30_000;
const MAX_COMPLETION_TOKENS = 4_096;

export interface ChatRequest {
  apiKey: string;
  messages: ChatCompletionMessageParam[];
  /** Read-only tools the model may call; `allowTools: false` asks for a final answer. */
  tools?: ChatCompletionTool[];
  allowTools?: boolean;
}

export interface ChatReply {
  message: ChatCompletionMessage;
  promptTokens: number;
  completionTokens: number;
}

const isServerError = (error: unknown): boolean =>
  error instanceof Groq.APIError && error.status !== undefined && error.status >= 500;

/** Provider errors as contract codes (API.md §4); the key and the provider's text are never echoed. */
function toAppError(error: unknown): AppError {
  if (error instanceof Groq.AuthenticationError || error instanceof Groq.PermissionDeniedError) {
    return new AppError('AI_NOT_CONFIGURED', 'Groq refused the API key. Replace it in Settings.');
  }
  if (error instanceof Groq.RateLimitError) {
    return new AppError('AI_UNAVAILABLE', 'The AI service is busy. Try again in a minute.');
  }
  return new AppError('AI_UNAVAILABLE', 'The AI service is not responding. Try again later.');
}

/**
 * Groq chat completions (SYSTEM_DESIGN.md §8 step 5): 30 s timeout, an output token cap and one retry
 * on a 5xx. The model comes from `GROQ_MODEL`; GPT-OSS models reason briefly and return no reasoning
 * text, which keeps responses small.
 */
@Injectable()
export class GroqClient {
  readonly model: string;
  private readonly baseURL: string | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.model = config.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
    this.baseURL = config.GROQ_BASE_URL;
  }

  async chat(request: ChatRequest): Promise<ChatReply> {
    try {
      return await this.once(request);
    } catch (error) {
      if (!isServerError(error)) {
        throw toAppError(error);
      }
    }
    try {
      return await this.once(request);
    } catch (error) {
      throw toAppError(error);
    }
  }

  private async once(request: ChatRequest): Promise<ChatReply> {
    const client = new Groq({
      apiKey: request.apiKey,
      ...(this.baseURL === undefined ? {} : { baseURL: this.baseURL }),
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    });
    const reasoning = this.model.startsWith('openai/gpt-oss')
      ? { reasoning_effort: 'low' as const, include_reasoning: false }
      : {};
    // no-select: a Groq SDK chat completion, not a Prisma write
    const completion = await client.chat.completions.create({
      model: this.model,
      messages: request.messages,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      temperature: 0.3,
      ...reasoning,
      ...(request.tools === undefined
        ? {}
        : { tools: request.tools, tool_choice: request.allowTools === false ? 'none' : 'auto' }),
    });
    const message = completion.choices[0]?.message;
    if (message === undefined) {
      throw new AppError('AI_UNAVAILABLE', 'The AI service returned no answer. Try again.');
    }
    return {
      message,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    };
  }
}
