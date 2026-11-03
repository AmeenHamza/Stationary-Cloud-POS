import { expect, test, type Browser, type Page } from '@playwright/test';

import { signInOnce } from '../fixtures/auth.fixture.js';
import { graphqlAsPage, restockViaApi, seedProduct } from '../fixtures/catalog.fixture.js';
import { liveChannel } from '../fixtures/realtime.fixture.js';
import { E2E_USERS, type E2eUser } from '../fixtures/users.js';

import type { WebSocketRoute } from '@playwright/test';

/** Live updates and the connection banner (F-13, F-37): no reloads, no polling. */
test.describe.configure({ mode: 'serial' });

async function signedIn(browser: Browser, user: E2eUser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signInOnce(page, user, '/dashboard');
  return page;
}

const badge = (page: Page) => page.getByTestId('low-stock-badge').first();

async function expectBadge(page: Page, count: number): Promise<void> {
  await (count === 0
    ? expect(badge(page)).toBeHidden()
    : expect(badge(page)).toHaveText(String(count)));
}

const banner = (page: Page) => page.getByRole('status').filter({ hasText: /Live updates|Offline/ });

test('the low-stock badge and product rows update live on another admin screen (E2E-05)', async ({
  browser,
}) => {
  const owner = await signedIn(browser, E2E_USERS.owner);
  const watcher = await signedIn(browser, E2E_USERS.watcher);
  const { lowStockCount: before } = await graphqlAsPage<{ lowStockCount: number }>(
    watcher,
    '{ lowStockCount }',
  );
  let live = liveChannel(watcher);
  await watcher.goto('/products');
  await live;
  await expectBadge(watcher, before);

  const product = await seedProduct(owner, { name: 'Live Marker', initialStockPieces: 2 });
  await expectBadge(watcher, before + 1); // lowStock.countChanged → coalesced refetch

  live = liveChannel(watcher);
  await watcher.reload(); // the new product appears on the next navigation (§5.9)
  await live;
  await watcher.getByLabel('Search products').fill('Live Marker'); // other specs' rows come first
  await watcher.getByRole('button', { name: 'Search' }).click();
  const stock = watcher.getByRole('row').filter({ hasText: 'Live Marker' }).getByTestId('stock');
  await expect(stock).toContainText('2 pcs');
  await restockViaApi(owner, product.id, 10);
  await expect(stock).toContainText('12 pcs'); // stock.changed patched the cached row
  await expectBadge(watcher, before);
  await owner.context().close();
  await watcher.context().close();
});

test('a dropped live channel shows the amber banner, then reconciles once (E2E-07)', async ({
  browser,
}) => {
  const page = await (await browser.newContext()).newPage();
  let blocked = false;
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/graphql$/, (ws) => {
    if (blocked) {
      void ws.close({ code: 1013, reason: 'blocked by test' }); // "try again later": retried
      return;
    }
    ws.connectToServer();
    sockets.push(ws);
  });
  await signInOnce(page, E2E_USERS.owner, '/dashboard');
  const live = liveChannel(page);
  await page.goto('/products');
  await live; // drop a connected, subscribed channel, as a network failure would

  blocked = true;
  await Promise.all(sockets.map((ws) => ws.close({ code: 1012, reason: 'dropped by test' })));
  await expect(banner(page)).toHaveText(/Live updates paused/);

  const graphqlPosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/graphql')) {
      graphqlPosts.push(request.postData() ?? '');
    }
  });
  blocked = false;
  await expect(banner(page)).toBeHidden({ timeout: 40_000 });
  await page.waitForLoadState('networkidle');
  // Active queries here: Me, Products, CategoryOptions, LowStockCount (+1 allowed by E2E-07).
  expect(graphqlPosts.length).toBeLessThanOrEqual(5);
  expect(graphqlPosts.some((body) => body.includes('query Products'))).toBe(true);
  await page.context().close();
});

test('going offline shows the red banner until the network returns (F-37)', async ({ browser }) => {
  const page = await signedIn(browser, E2E_USERS.watcher);
  await page.context().setOffline(true);
  await expect(banner(page)).toHaveText(/Offline: billing paused/);
  // A refresh while offline fails its requests at network level (offline until a success).
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.context().setOffline(false);
  // The `online` event runs recovery at once, not after the socket's back-off (up to 30 s).
  await expect(banner(page)).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.context().close();
});
