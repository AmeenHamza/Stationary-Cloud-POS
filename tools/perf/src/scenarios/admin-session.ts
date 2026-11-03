import { randomUUID } from 'node:crypto';

import { WORKLOAD } from '../config.js';
import { seededRandom } from '../random.js';

import * as op from './operations.js';

import type { GraphqlSession } from '../measure/http-client.js';

export type AdminScreen = 'dashboard' | 'orders' | 'khata' | 'lowStock';

/** Events whose arrival refetches the open overview (web `event-router.ts`, coalesced). */
const DASHBOARD_EVENTS = new Set([
  'OrderCreatedEvent',
  'OrderRefundedEvent',
  'StockChangedEvent',
  'CustomerBalanceChangedEvent',
]);

/**
 * The admin's tab: the screen it shows and the refetches that live events trigger there, coalesced
 * per burst like the browser does (one refetch per query per drain).
 */
export class AdminTab {
  screen: AdminScreen = 'dashboard';
  private dashboardStale = false;
  private lowStockStale = false;

  constructor(private readonly tab: GraphqlSession) {}

  /** For the live channel: remember what the screen would refetch. */
  readonly onEvent = (typename: string): void => {
    if (DASHBOARD_EVENTS.has(typename)) {
      this.dashboardStale = true;
    }
    if (typename === 'LowStockCountChangedEvent') {
      this.lowStockStale = true;
    }
  };

  /** App load: the viewer, the low-stock badge and the overview (admins land on /dashboard). */
  async open(): Promise<void> {
    await this.tab.run(op.MeDocument, {});
    await this.tab.run(op.LowStockCountDocument, {});
    await this.visit('dashboard');
  }

  async visit(screen: AdminScreen): Promise<void> {
    this.screen = screen;
    if (screen === 'dashboard') {
      await this.tab.run(op.DashboardLiveDocument, {});
      await this.tab.run(op.DashboardHistoryDocument, { year: new Date(Date.now()).getFullYear() });
    } else if (screen === 'orders') {
      await this.tab.run(op.OrdersDocument, {});
    } else if (screen === 'khata') {
      const page = await this.tab.run(op.CustomersDocument, { filter: { withBalanceOnly: true } });
      const customer = page.customers.nodes[0];
      if (customer !== undefined) {
        await this.tab.run(op.CustomerLedgerDocument, { customerId: customer.id });
      }
    } else {
      await this.tab.run(op.LowStockProductsDocument, {});
    }
  }

  /** The coalesced refetches for events received since the last drain. */
  async drain(): Promise<void> {
    if (this.dashboardStale && this.screen === 'dashboard') {
      await this.tab.run(op.DashboardLiveDocument, {});
    }
    if (this.lowStockStale) {
      await this.tab.run(op.LowStockCountDocument, {});
      if (this.screen === 'lowStock') {
        await this.tab.run(op.LowStockProductsDocument, {});
      }
    }
    this.dashboardStale = false;
    this.lowStockStale = false;
  }

  /** A restock from the low-stock list: one box or ten pieces of its first product. */
  async restock(): Promise<void> {
    await this.visit('lowStock');
    const page = await this.tab.run(op.LowStockProductsDocument, {});
    const product = page.lowStockProducts.nodes[0];
    if (product !== undefined) {
      await this.tab.run(op.RestockProductDocument, {
        input: { idempotencyKey: randomUUID(), productId: product.id, boxes: 0, pieces: 10 },
      });
    }
  }
}

/** Admin visits spread over the day (§8.2): 5 overview, 5 orders, 10 khata, 3 low stock. */
export function visitPlan(): AdminScreen[] {
  const { dashboard, orders, khata, lowStock } = WORKLOAD.adminVisits;
  const pool: AdminScreen[] = [
    ...Array<AdminScreen>(dashboard).fill('dashboard'),
    ...Array<AdminScreen>(orders).fill('orders'),
    ...Array<AdminScreen>(khata).fill('khata'),
    ...Array<AdminScreen>(lowStock).fill('lowStock'),
  ];
  const random = seededRandom(WORKLOAD.seed + 1);
  return pool
    .map((screen) => ({ screen, key: random.next() }))
    .sort((a, b) => a.key - b.key)
    .map((v) => v.screen);
}
