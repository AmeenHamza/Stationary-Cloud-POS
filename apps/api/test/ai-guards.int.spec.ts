import { beforeAll, describe, expect, it } from 'vitest';

import { addDays, businessDateOf } from '@pos/domain';
import { querySql } from '@pos/testkit';

import { AI, SET_KEY, aiInput, newTestKey, useAiHarness } from './support/ai';
import { createUser, loginCookie } from './support/auth';
import { errorCode } from './support/graphql-client';
import { asUser } from './support/staff';

const t = useAiHarness();

beforeAll(async () => {
  await asUser(t.h.url, t.admin, SET_KEY, { input: { apiKey: newTestKey() } });
});

describe('AI guards (API.md §4, §8; SYSTEM_DESIGN.md §8)', () => {
  it('refuses cashiers and out-of-bounds inputs before any provider call', async () => {
    t.stub.reset();
    const cashier = await asUser(t.h.url, t.cashier, AI.DISCOUNT_ADVICE, {
      input: aiInput('DISCOUNT_ADVICE', 'ENGLISH'),
    });
    expect(errorCode(cashier)).toBe('FORBIDDEN');
    expect(errorCode(await t.run('SALES_INSIGHTS', 'ENGLISH', { periodDays: 31 }))).toBe(
      'BAD_USER_INPUT',
    );
    const today = businessDateOf(new Date(Date.now()), 'Asia/Karachi');
    const future = { period: 'CUSTOM', from: today, to: addDays(today, 1) };
    expect(errorCode(await t.run('BUSINESS_REPORT', 'ENGLISH', future))).toBe('BAD_USER_INPUT');
    const longHistory = Array.from({ length: 11 }, () => ({ role: 'USER', text: 'hi' }));
    expect(errorCode(await t.run('ASK', 'ENGLISH', { history: longHistory }))).toBe(
      'BAD_USER_INPUT',
    );
    expect(t.stub.requests).toHaveLength(0);
  });

  it('maps provider failures: one retry on 5xx, then AI_UNAVAILABLE; a refused key is AI_NOT_CONFIGURED', async () => {
    t.stub.reset();
    t.stub.reply(() => ({ status: 503 }));
    expect(errorCode(await t.run('INVENTORY_FORECAST', 'URDU'))).toBe('AI_UNAVAILABLE');
    expect(t.stub.requests).toHaveLength(2);
    t.stub.reset();
    t.stub.reply(() => ({ status: 401 }));
    expect(errorCode(await t.run('INVENTORY_FORECAST', 'ENGLISH'))).toBe('AI_NOT_CONFIGURED');
    expect(t.stub.requests).toHaveLength(1);
    t.stub.reset();
  });

  it('audits each request with tokens and latency, never the prompt or the answer', async () => {
    const response = await t.run('PURCHASE_RECOMMENDATIONS', 'ROMAN_URDU');
    expect(response.body.errors).toBeUndefined();
    const rows = await querySql<{ metadata: Record<string, unknown> }>(
      t.h.db.url,
      `SELECT metadata FROM audit_logs WHERE action = 'ai.requested' ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0]?.metadata).toMatchObject({
      feature: 'PURCHASE_RECOMMENDATIONS',
      language: 'ROMAN_URDU',
      cached: false,
      promptTokens: 100,
      completionTokens: 50,
    });
    expect(Object.keys(rows[0]?.metadata ?? {}).sort()).toEqual([
      'cached',
      'completionTokens',
      'feature',
      'language',
      'latencyMs',
      'promptTokens',
      'toolRounds',
    ]);
  });

  it('keeps answering while Redis is down: the `ai` limit counts in memory (ADR-049)', async () => {
    await t.h.cutRedis();
    expect((await t.run('DISCOUNT_ADVICE', 'ENGLISH')).body.errors).toBeUndefined();
    t.h.redisProxy.restore();
    await t.h.redisReady();
    expect((await t.run('DISCOUNT_ADVICE', 'ENGLISH')).body.errors).toBeUndefined();
  });

  it('allows 30 AI requests per user per hour, then RATE_LIMITED (cached answers count too)', async () => {
    const cookie = await loginCookie(
      t.h.url,
      await createUser(t.h, { username: 'busy.owner', role: 'ADMIN' }),
    );
    const ask = () =>
      asUser(t.h.url, cookie, AI.DISCOUNT_ADVICE, { input: aiInput('DISCOUNT_ADVICE', 'URDU') });
    for (let request = 1; request <= 30; request += 1) {
      expect((await ask()).body.errors, `request ${String(request)}`).toBeUndefined();
    }
    const limited = await ask();
    expect(errorCode(limited)).toBe('RATE_LIMITED');
    expect(limited.body.errors?.[0]?.extensions?.['retryAfterSeconds']).toBeGreaterThan(0);
  });
});
