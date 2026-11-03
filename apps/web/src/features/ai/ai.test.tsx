import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AI_FEATURES, AI_HISTORY_MAX_CHARS } from '@pos/contracts';

import { AiMarkdown } from './components/AiMarkdown';
import { directionOf } from './components/AiResultView';
import { AI_FEATURE_LIST, aiFeatureBySlug } from './lib/ai-features';
import { historyForRequest, type ChatTurn } from './lib/chat-history';
import { reportInput } from './lib/report-input';

describe('AI answers are rendered safely (SYSTEM_DESIGN.md §8 step 7)', () => {
  it('renders headings, lists and tables but never raw HTML, links or images', () => {
    const markdown = [
      '## Summary',
      '- Net sales: **Rs 1,234.50**',
      '',
      '| Product | Units |',
      '|---|---|',
      '| Gel pen | 12 |',
      '',
      '<script>alert(1)</script><img src=x onerror="alert(2)">',
      '[click me](javascript:alert(3)) ![logo](https://example.com/x.png)',
    ].join('\n');
    const { container } = render(<AiMarkdown text={markdown} />);
    expect(container.querySelector('h3')?.textContent).toBe('Summary');
    expect(container.querySelector('li strong')?.textContent).toBe('Rs 1,234.50');
    expect(container.querySelector('td')?.textContent).toBe('Gel pen');
    expect(container.querySelector('script, img, a, iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.textContent).toContain('click me'); // the link text stays, without the link
  });

  it('reads Urdu answers right to left', () => {
    expect(directionOf('URDU')).toBe('rtl');
    expect(directionOf('ROMAN_URDU')).toBe('ltr');
    expect(directionOf('ENGLISH')).toBe('ltr');
  });
});

describe('AI features and chat history (F-29, API.md §6.2)', () => {
  it('lists each of the six features once, with a unique page', () => {
    expect(AI_FEATURE_LIST.map((info) => info.feature).sort()).toEqual([...AI_FEATURES].sort());
    expect(new Set(AI_FEATURE_LIST.map((info) => info.slug)).size).toBe(AI_FEATURES.length);
    expect(aiFeatureBySlug('business-report')?.printable).toBe(true);
    expect(aiFeatureBySlug('nope')).toBeUndefined();
  });

  it('sends only the latest turns that fit 10 turns and 4,000 characters', () => {
    const turns: ChatTurn[] = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? 'USER' : 'ASSISTANT',
      text: `turn ${String(index)}`,
    }));
    const kept = historyForRequest(turns);
    expect(kept).toHaveLength(10);
    expect(kept[0]?.text).toBe('turn 4');
    expect(kept.at(-1)?.text).toBe('turn 13');

    const long: ChatTurn[] = [
      { role: 'USER', text: 'a'.repeat(3_000) },
      { role: 'ASSISTANT', text: 'b'.repeat(1_500) },
      { role: 'USER', text: 'c'.repeat(2_000) },
    ];
    const fitted = historyForRequest(long);
    expect(fitted.map((turn) => turn.text[0])).toEqual(['b', 'c']);
    expect(fitted.reduce((total, turn) => total + turn.text.length, 0)).toBeLessThanOrEqual(
      AI_HISTORY_MAX_CHARS,
    );
  });
});

describe('business report form (API.md §6.2)', () => {
  it('sends empty date fields as null, and needs both dates only for a custom range', () => {
    expect(reportInput({ period: 'DAILY', from: '', to: '' }, 'ENGLISH')).toEqual({
      input: { period: 'DAILY', from: null, to: null, language: 'ENGLISH' },
    });
    expect(reportInput({ period: 'CUSTOM', from: '2026-10-01', to: '' }, 'URDU')).toHaveProperty(
      'error',
    );
    expect(reportInput({ period: 'CUSTOM', from: '2026-10-01', to: '2026-10-31' }, 'URDU')).toEqual(
      { input: { period: 'CUSTOM', from: '2026-10-01', to: '2026-10-31', language: 'URDU' } },
    );
  });
});
