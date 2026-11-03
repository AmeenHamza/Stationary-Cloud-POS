import { writeFile } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { openAs } from '../fixtures/billing.fixture.js';
import { measureLoads, trafficMeter, type TrafficMeter } from '../fixtures/network.fixture.js';
import { E2E_USERS, type E2eUser } from '../fixtures/users.js';

/** NETWORK_OPTIMIZATION.md §4.4. */
const KB = 1_024;
const TERMINAL_COLD_TOTAL = 450 * KB;
/** Tuned with Phase 14 evidence: 363–381 KB measured (1 KB = 1,024 B), the stack floor (ADR-042). */
const FIRST_LOAD_SCRIPT = 410 * KB;
const WARM_VISIT_TOTAL = 30 * KB; // hashed chunks come from the HTTP cache

const searchBox = (page: Page) => page.getByLabel('Search by name or scan barcode');
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });

const IDLE_SCREENS: readonly { path: string; user: E2eUser; ready: (page: Page) => Locator }[] = [
  { path: '/terminal', user: E2E_USERS.seller, ready: (page) => searchBox(page) },
  { path: '/dashboard', user: E2E_USERS.overseer, ready: (page) => heading(page, 'Overview') },
  { path: '/low-stock', user: E2E_USERS.overseer, ready: (page) => heading(page, 'Low stock') },
  { path: '/orders', user: E2E_USERS.overseer, ready: (page) => heading(page, 'Order history') },
];

for (const screen of IDLE_SCREENS) {
  test(`${screen.path} sends no API request while idle for 2 minutes (NET-04)`, async ({
    browser,
  }) => {
    let meter: TrafficMeter | undefined;
    const page = await openAs(browser, screen.user, screen.path, async (fresh) => {
      meter = trafficMeter(fresh);
      await fresh.clock.install(); // timers run on a fake clock that is fast-forwarded below
    });
    await expect(screen.ready(page)).toBeVisible();
    await page.waitForLoadState('networkidle');
    meter?.reset();
    await page.clock.runFor('02:00'); // every timer due in two minutes fires, in order
    await page.waitForLoadState('networkidle');
    expect(meter?.apiRequests).toEqual([]);
    // Only protocol keep-alives may cross the socket while nothing happens (SYSTEM_DESIGN.md §5.6).
    const keepAlive = new Set(['ping', 'pong']);
    expect(meter?.socketMessages.filter((type) => !keepAlive.has(type))).toEqual([]);
    await page.context().close();
  });
}

test('first-load transfer of the terminal and admin screens, cold and warm (NET-05)', async ({
  browser,
}) => {
  const loads = {
    terminal: await measureLoads(browser, E2E_USERS.seller, '/terminal', async (page) => {
      await expect(searchBox(page)).toBeVisible();
    }),
    products: await measureLoads(browser, E2E_USERS.overseer, '/products', async (page) => {
      await expect(heading(page, 'Products')).toBeVisible();
    }),
    orders: await measureLoads(browser, E2E_USERS.overseer, '/orders', async (page) => {
      await expect(heading(page, 'Order history')).toBeVisible();
    }),
    dashboard: await measureLoads(browser, E2E_USERS.overseer, '/dashboard', async (page) => {
      await expect(page.getByText(/^Sales analytics/)).toBeVisible(); // includes the chart chunk
    }),
  };
  await writeFile(test.info().outputPath('network-loads.json'), JSON.stringify(loads, null, 2));
  expect(loads.terminal.cold.total).toBeLessThanOrEqual(TERMINAL_COLD_TOTAL);
  for (const [route, load] of Object.entries(loads)) {
    expect(load.cold.script, `${route} first-load JS`).toBeLessThanOrEqual(FIRST_LOAD_SCRIPT);
    expect(load.warm.total, `${route} repeat visit`).toBeLessThanOrEqual(WARM_VISIT_TOTAL);
  }
});
