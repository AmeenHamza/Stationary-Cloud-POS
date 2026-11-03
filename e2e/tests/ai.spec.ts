import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { openAs, printCount } from '../fixtures/billing.fixture.js';
import { seedProduct } from '../fixtures/catalog.fixture.js';
import { API_LOG_FILE, E2E_USERS } from '../fixtures/users.js';

/** Fifteen answers, a print and a chat: more than the default 30 s per test. */
test.describe.configure({ timeout: 120_000 });

/** The stub's first heading in each answer language (`@pos/testkit` groq-stub). */
const LANGUAGES = [
  { label: 'English', heading: 'Summary', dir: 'ltr' },
  { label: 'اردو', heading: 'خلاصہ', dir: 'rtl' },
  { label: 'Roman Urdu', heading: 'Khulasa', dir: 'ltr' },
] as const;

const FEATURE_PAGES = [
  'sales-insights',
  'inventory-forecast',
  'purchase-recommendations',
  'business-report',
  'discount-advice',
];

async function chooseLanguage(page: Page, label: string): Promise<void> {
  await page
    .getByRole('group', { name: 'Answer language' })
    .getByText(label, { exact: true })
    .click();
}

/** Saves the key in Settings: typed masked, shown on request, then only its last 4 come back. */
async function saveKey(page: Page, key: string): Promise<void> {
  await page.goto('/settings');
  const input = page.getByLabel('Groq API key');
  await input.fill(key);
  await expect(input).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show key' }).click();
  await expect(input).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByText(`Key ending •••• ${key.slice(-4)}`)).toBeVisible();
  await expect(page.getByLabel('Replace key')).toHaveValue('');
}

test('every AI feature answers in all three languages against the Groq stub (E2E-14, F-29, F-30)', async ({
  browser,
}) => {
  const key = `test-groq-key-${randomBytes(16).toString('hex')}`;
  const page = await openAs(browser, E2E_USERS.advisor, '/dashboard');
  await seedProduct(page, { name: 'Advisor Marker Pen', salePrice: '40.00' });

  await page.getByRole('link', { name: 'AI Assistant' }).click();
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
  await expect(page.getByText(/Groq API key in Settings/)).toBeVisible(); // no key yet
  await saveKey(page, key);

  for (const slug of FEATURE_PAGES) {
    await page.goto(`/ai/${slug}`);
    await expect(page.getByText(/Groq API key in Settings/)).toBeHidden();
    for (const language of LANGUAGES) {
      await chooseLanguage(page, language.label);
      await page.getByRole('button', { name: 'Generate' }).click();
      const answer = page.getByRole('article', { name: 'AI answer' });
      await expect(answer, `${slug} ${language.label}`).toContainText(language.heading);
      await expect(answer.locator(`[dir="${language.dir}"]`)).toBeVisible();
    }
    if (slug === 'business-report') {
      await page.getByRole('button', { name: 'Print' }).click();
      await expect.poll(() => printCount(page)).toBe(1);
    }
    if (slug === 'discount-advice') {
      await expect(page.getByText(/No discount is applied automatically/)).toBeVisible();
    }
  }

  await page.goto('/ai/ask');
  await chooseLanguage(page, 'Roman Urdu');
  await page.getByRole('button', { name: 'Which products are running low?' }).click();
  const conversation = page.getByRole('list', { name: 'Conversation' });
  const turns = conversation.locator(':scope > li'); // not the bullets inside an answer
  await expect(turns).toHaveCount(2); // the question and the answer
  await expect(conversation).toContainText('Khulasa');
  await page.getByLabel('Your question').fill('And this week?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(turns).toHaveCount(4);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(turns).toHaveCount(0);

  const logged = await readFile(API_LOG_FILE, 'utf8');
  expect(logged.length).toBeGreaterThan(0);
  expect(logged).not.toContain(key.slice(-16)); // SEC-11: the key never reaches a log line
  await page.context().close();
});
