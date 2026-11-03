import { once } from 'node:events';
import { createServer, type IncomingMessage } from 'node:http';

import type { AddressInfo } from 'node:net';

/** One chat-completion request as the stub received it (TESTING.md: SEC-12 prompt capture). */
export interface GroqStubRequest {
  authorization: string;
  model: string;
  messages: { role: string; content?: string | null; tool_call_id?: string }[];
  tools?: unknown[];
  tool_choice?: unknown;
}

export interface GroqStubReply {
  status?: number;
  content?: string;
  toolCalls?: { name: string; arguments: string }[];
}

export type GroqStubHandler = (request: GroqStubRequest) => GroqStubReply;

export interface GroqStub {
  /** Base URL for `GROQ_BASE_URL`. */
  url: string;
  requests: GroqStubRequest[];
  /** Replaces the reply logic until `reset()`. */
  reply: (handler: GroqStubHandler) => void;
  reset: () => void;
  close: () => Promise<void>;
}

const HEADINGS: Readonly<Record<string, string>> = {
  ENGLISH: '## Summary',
  URDU: '## خلاصہ',
  ROMAN_URDU: '## Khulasa',
};

/** The language the system prompt asks for, from its wording. */
export function stubLanguage(system: string): 'ENGLISH' | 'URDU' | 'ROMAN_URDU' {
  if (system.includes('in Roman Urdu')) {
    return 'ROMAN_URDU';
  }
  return system.includes('in Urdu') ? 'URDU' : 'ENGLISH';
}

/**
 * Deterministic answers: a heading in the requested language, the task's first words and the first
 * money figure of the data, so tests see live data flow. With tools offered and none called yet, it
 * first asks for today's sales summary.
 */
export const defaultGroqReply: GroqStubHandler = (request) => {
  const system = request.messages.find((message) => message.role === 'system')?.content ?? '';
  const today = /Today is (\d{4}-\d{2}-\d{2})/.exec(system)?.[1] ?? '2026-01-01';
  const toolsAllowed = request.tools !== undefined && request.tool_choice !== 'none';
  if (toolsAllowed && !request.messages.some((message) => message.role === 'tool')) {
    return {
      toolCalls: [
        { name: 'get_sales_summary', arguments: JSON.stringify({ from: today, to: today }) },
      ],
    };
  }
  const task = /Task: ([^.]+)\./.exec(system)?.[1] ?? 'Answer';
  const data = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => message.content ?? '')
    .join('\n');
  const figure = /"(?:netSales|total|estimatedCost|stockCostValue)":"(\d+\.\d{2})"/.exec(data)?.[1];
  return {
    content: `${HEADINGS[stubLanguage(system)] ?? ''}\n\n**${task}**\n\n- Figure: Rs ${figure ?? '0.00'}\n`,
  };
};

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function completion(model: string, reply: GroqStubReply, sequence: number): object {
  const toolCalls = (reply.toolCalls ?? []).map((call, index) => ({
    id: `call_${String(sequence)}_${String(index)}`,
    type: 'function',
    function: call,
  }));
  return {
    id: `chatcmpl-stub-${String(sequence)}`,
    object: 'chat.completion',
    created: 0,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: reply.content ?? null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

/** Starts the stub on a free local port (or `port`); it answers `POST …/chat/completions`. */
export async function startGroqStub(port = 0): Promise<GroqStub> {
  const requests: GroqStubRequest[] = [];
  let handler: GroqStubHandler = defaultGroqReply;
  const server = createServer((req, res) => {
    void (async () => {
      const body = (await bodyOf(req)) as Omit<GroqStubRequest, 'authorization'>;
      const request = { ...body, authorization: req.headers.authorization ?? '' };
      requests.push(request);
      const reply = handler(request);
      const status = reply.status ?? 200;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          status === 200
            ? completion(body.model, reply, requests.length)
            : { error: { message: 'stub failure', type: 'stub_error' } },
        ),
      );
    })();
  });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  const { port: actual } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(actual)}`,
    requests,
    reply: (next) => {
      handler = next;
    },
    reset: () => {
      handler = defaultGroqReply;
      requests.length = 0;
    },
    close: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
    },
  };
}
