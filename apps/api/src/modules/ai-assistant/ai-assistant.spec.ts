import { describe, expect, it } from 'vitest';

import { AI_FEATURES, AI_LANGUAGES } from '@pos/contracts';
import { stubLanguage } from '@pos/testkit';

import { daysIn } from '../reporting';

import { answerText } from './application/ai-request.service';
import { AI_TOOLS } from './application/ai-tools';
import { featureMessages, systemPrompt } from './application/prompt-builder';

describe('AI prompts (SYSTEM_DESIGN.md §8 step 4)', () => {
  it('states the language, the data-only rule and the business date for every feature', () => {
    for (const feature of AI_FEATURES) {
      for (const language of AI_LANGUAGES) {
        const prompt = systemPrompt(feature, language, '2026-11-01');
        expect(prompt).toContain('Use only the numbers');
        expect(prompt).toContain('no information about individual customers');
        expect(prompt).toContain('Today is 2026-11-01');
        expect(stubLanguage(prompt)).toBe(language); // the stub and the rule agree
      }
    }
  });

  it('keeps discount advice to recommendations, never below cost (BR-15)', () => {
    const prompt = systemPrompt('DISCOUNT_ADVICE', 'ENGLISH', '2026-11-01');
    expect(prompt).toContain('no discount is applied automatically');
    expect(prompt).toContain('never suggest a price below the cost price');
  });

  it('sends the data as one compact JSON message after the system prompt', () => {
    const messages = featureMessages('INVENTORY_FORECAST', 'URDU', '2026-11-01', { a: [1, 2] });
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(messages[1]?.content).toBe('Shop data (JSON):\n{"a":[1,2]}');
  });
});

describe('AI helpers', () => {
  it('treats an empty answer as the provider failing', () => {
    expect(answerText('  ## Hi  ')).toBe('## Hi');
    expect(() => answerText('   ')).toThrow('empty answer');
    expect(() => answerText(null)).toThrow('empty answer');
  });

  it('offers exactly the five read-only tools', () => {
    expect(AI_TOOLS.map((tool) => tool.function?.name)).toEqual([
      'get_sales_summary',
      'get_top_products',
      'get_slow_movers',
      'get_low_stock',
      'get_product_sales',
    ]);
  });

  it('counts calendar days in a range, both ends included', () => {
    expect(daysIn('2026-11-01', '2026-11-01')).toBe(1);
    expect(daysIn('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysIn('2026-02-01', '2026-03-01')).toBe(29);
    expect(daysIn('2026-03-28', '2026-03-30')).toBe(3);
  });
});
