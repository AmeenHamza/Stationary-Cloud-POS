import { describe, expect, it } from 'vitest';

import { AI_FEATURES, AI_LANGUAGES } from '@pos/contracts';
import { querySql } from '@pos/testkit';

import {
  CLEAR_KEY,
  KEY_STATUS,
  SET_KEY,
  newTestKey,
  useAiHarness,
  type AiResultBody,
} from './support/ai';
import { dataOf, errorCode } from './support/graphql-client';
import * as khata from './support/khata';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useAiHarness();
const key = newTestKey();

function resultOf(response: { body: { data?: unknown } }, field: string): AiResultBody {
  const data = response.body.data as Record<string, AiResultBody | undefined> | undefined;
  const result = data?.[field];
  if (result === undefined) {
    throw new Error(`no ${field} in the response`);
  }
  return result;
}

describe('Groq key management (F-30, SEC-11, SEC-03)', () => {
  it('stores the key encrypted, shows only its last 4 characters and never returns it', async () => {
    expect(dataOf(await asUser(t.h.url, t.admin, KEY_STATUS))).toEqual({
      shopSettings: { aiKeyConfigured: false, aiKeyLast4: null },
    });
    expect(errorCode(await t.run('INVENTORY_FORECAST', 'ENGLISH'))).toBe('AI_NOT_CONFIGURED');

    const saved = await asUser(t.h.url, t.admin, SET_KEY, { input: { apiKey: ` ${key} ` } });
    expect(dataOf(saved)).toEqual({
      setAiApiKey: { aiKeyConfigured: true, aiKeyLast4: key.slice(-4) },
    });
    expect(JSON.stringify(saved.body)).not.toContain(key);

    const cashier = await asUser(t.h.url, t.cashier, KEY_STATUS);
    expect(errorCode(cashier)).toBe('FORBIDDEN');
    expect(errorCode(await asUser(t.h.url, t.cashier, SET_KEY, { input: { apiKey: key } }))).toBe(
      'FORBIDDEN',
    );

    const [row] = await querySql<{ ciphertext: Buffer; last4: string }>(
      t.h.db.url,
      'SELECT groq_api_key_ciphertext AS ciphertext, groq_api_key_last4 AS last4 FROM shop_settings',
    );
    expect(row?.last4).toBe(key.slice(-4));
    expect(row?.ciphertext.toString('latin1')).not.toContain(key.slice(0, 12));
    const audit = await querySql<{ text: string }>(
      t.h.db.url,
      `SELECT action || coalesce(metadata::text, '') AS text FROM audit_logs WHERE action LIKE 'settings.aiKey%'`,
    );
    const outbox = await querySql<{ text: string }>(
      t.h.db.url,
      'SELECT payload::text AS text FROM outbox_events',
    );
    for (const { text } of [...audit, ...outbox]) {
      expect(text).not.toContain(key.slice(-12));
    }

    const answer = await t.run('INVENTORY_FORECAST', 'ENGLISH');
    expect(answer.body.errors).toBeUndefined();
    expect(t.stub.requests.at(-1)?.authorization).toBe(`Bearer ${key}`); // decrypted on use only
    expect(JSON.stringify(answer.body)).not.toContain(key);
  });

  it('clears the key; features then answer AI_NOT_CONFIGURED until it is set again', async () => {
    expect(dataOf(await asUser(t.h.url, t.admin, CLEAR_KEY))).toEqual({
      clearAiApiKey: { aiKeyConfigured: false, aiKeyLast4: null },
    });
    expect(errorCode(await t.run('DISCOUNT_ADVICE', 'ENGLISH'))).toBe('AI_NOT_CONFIGURED');
    await asUser(t.h.url, t.admin, SET_KEY, { input: { apiKey: key } });
  });
});

describe('AI features against the Groq stub (F-29, SEC-12)', () => {
  it('answers all six features in all three languages from live data, then from the cache', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, {
      name: 'Private Person',
      phone: '0300 1234567',
    });
    const productId = await sales.seedProduct(t.prisma, { name: 'Gel pen blue', price: '45.50' });
    const sale = await asUser(t.h.url, t.cashier, sales.CREATE_SALE, {
      input: sales.saleInput([{ productId, quantity: 2 }], {
        paymentMethod: 'UDHAAR',
        customerId: customer.id,
        expectedTotal: '91.00',
      }),
    });
    expect(sale.body.errors).toBeUndefined();
    const redis = t.h.redis('cache');
    const cachedAnswers = await redis.keys('pos:v1:ai:*'); // answers from the test above
    if (cachedAnswers.length > 0) {
      await redis.del(...cachedAnswers);
    }
    t.stub.reset();

    for (const feature of AI_FEATURES) {
      for (const language of AI_LANGUAGES) {
        const response = await t.run(feature, language);
        expect(response.body.errors, `${feature} ${language}`).toBeUndefined();
        const field = Object.keys(response.body.data ?? {})[0] ?? '';
        const result = resultOf(response, field);
        expect(result).toMatchObject({ language, cached: false });
        const heading = { ENGLISH: 'Summary', URDU: 'خلاصہ', ROMAN_URDU: 'Khulasa' }[language];
        expect(result.text).toContain(heading);
      }
    }
    const sent = JSON.stringify(t.stub.requests);
    expect(sent).toContain('Gel pen blue'); // product names may leave the shop (Q17b)
    expect(sent).toContain('91.00');
    for (const secret of ['Private Person', '0300 1234567', '03001234567', customer.id]) {
      expect(sent).not.toContain(secret); // never customer names, phones or ids (SEC-12)
    }
    expect(sent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/); // no internal ids at all
    const sizes = t.stub.requests.map((request) => Buffer.byteLength(JSON.stringify(request)));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(8 * 1_024); // small data: well under the 12 KB bound

    const requestsBefore = t.stub.requests.length;
    const again = await t.run('SALES_INSIGHTS', 'URDU');
    expect(resultOf(again, 'aiSalesInsights').cached).toBe(true);
    expect(t.stub.requests.length).toBe(requestsBefore);
  });

  it('chat: calls read-only tools for figures, refuses bad arguments and stops after 3 rounds', async () => {
    t.stub.reset();
    const answer = await t.run('ASK', 'ENGLISH', { question: 'Sales today, please?' });
    expect(answer.body.errors).toBeUndefined();
    expect(t.stub.requests).toHaveLength(2); // the tool call, then the answer
    const toolResult = t.stub.requests[1]?.messages.find((message) => message.role === 'tool');
    expect(toolResult?.content).toContain('"totals"');

    t.stub.reset();
    t.stub.reply((request) =>
      request.tool_choice === 'none'
        ? { content: 'Final answer' }
        : {
            toolCalls: [
              { name: 'get_top_products', arguments: '{"limit":999}' },
              { name: 'drop_tables', arguments: '{}' },
            ],
          },
    );
    const bounded = await t.run('ASK', 'ENGLISH', { question: 'Top sellers?' });
    expect(resultOf(bounded, 'aiAsk').text).toBe('Final answer');
    expect(t.stub.requests).toHaveLength(4);
    const tools = t.stub.requests[1]?.messages.filter((message) => message.role === 'tool');
    expect(tools?.map((message) => message.content)).toEqual([
      expect.stringContaining('Invalid arguments'),
      expect.stringContaining('Unknown tool'),
    ]);
    t.stub.reset();
  });
});
