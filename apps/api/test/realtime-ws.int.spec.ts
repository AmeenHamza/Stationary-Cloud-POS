import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { RedisPubSub } from '../src/infrastructure/realtime/redis-pubsub';
import { RealtimeHub } from '../src/modules/realtime/application/realtime-hub';
import { WsConnectionService } from '../src/modules/realtime/application/ws-connection.service';

import { createUser, loginCookie, type TestUser } from './support/auth';
import * as catalog from './support/catalog';
import { startHarness, type Harness } from './support/harness';
import { asUser, SET_STATUS } from './support/staff';
import {
  eventOf,
  isAck,
  isEvent,
  liveEvents,
  openSocket,
  SHOP_EVENTS,
  type WsMessage,
} from './support/ws-client';

let h: Harness;
let admin: string;
let cashierUser: TestUser;
let cashier: string;

beforeAll(async () => {
  h = await startHarness();
  admin = await loginCookie(h.url, await createUser(h, { username: 'owner', role: 'ADMIN' }));
  cashierUser = await createUser(h, { username: 'till', role: 'CASHIER' });
  cashier = await loginCookie(h.url, cashierUser);
});

afterAll(async () => {
  await h.stop();
});

const isError = (message: WsMessage): boolean => message.type === 'error';

describe('WebSocket admission (SEC-08)', () => {
  it('closes a foreign Origin with 4403 and a missing session with 4401', async () => {
    const foreign = openSocket(h.url, { cookie: admin, origin: 'https://evil.example' });
    expect((await foreign.closed).code).toBe(4403);
    const anonymous = openSocket(h.url);
    expect((await anonymous.closed).code).toBe(4401);
  });

  it('runs only subscriptions, at most three per socket', async () => {
    const socket = openSocket(h.url, { cookie: cashier });
    await socket.waitFor(isAck);
    socket.subscribe('q', '{ me { id } }');
    expect(await socket.waitFor((m) => isError(m) && m.id === 'q')).toBeDefined();
    for (const id of ['a', 'b', 'c', 'd']) {
      socket.subscribe(id, SHOP_EVENTS);
    }
    const refused = await socket.waitFor((m) => isError(m) && m.id === 'd');
    expect(JSON.stringify(refused.payload)).toContain('RATE_LIMITED');
    await socket.close();
  });
});

describe('event delivery (RT-01, RT-02)', () => {
  it('delivers catalogue events to staff and low-stock events to admins only', async () => {
    const adminSocket = await liveEvents(h.url, { cookie: admin });
    const cashierSocket = await liveEvents(h.url, { cookie: cashier });

    const product = await catalog.createProduct(h.url, admin, {
      lowStockThreshold: 5,
      initialStockPieces: 2,
    });
    const changed = (m: WsMessage) =>
      isEvent('product.changed', (e) => e['productId'] === product.id)(m);
    for (const socket of [adminSocket, cashierSocket]) {
      const event = eventOf(await socket.waitFor(changed));
      expect(event).toMatchObject({
        __typename: 'ProductChangedEvent',
        change: 'CREATED',
        product: { id: product.id, stockPieces: 2 },
      });
    }
    const low = eventOf(await adminSocket.waitFor(isEvent('lowStock.countChanged')));
    expect(low?.['crossedProductIds']).toEqual([product.id]);

    // A later staff event proves the cashier socket has caught up past the admin-only event.
    await asUser(h.url, admin, catalog.RESTOCK, { input: catalog.restockInput(product.id) });
    const stock = eventOf(await cashierSocket.waitFor(isEvent('stock.changed')));
    expect(stock?.['items']).toEqual([
      { productId: product.id, stockPieces: 3, isLowStock: true, version: 2 },
    ]);
    expect(cashierSocket.messages.some(isEvent('lowStock.countChanged'))).toBe(false);

    await Promise.all([adminSocket.close(), cashierSocket.close()]);
  });

  it('closes the socket of a disabled user with 4401 (SEC-05, one instance)', async () => {
    const user = await createUser(h, { username: 'leaver', role: 'CASHIER' });
    const socket = await liveEvents(h.url, { cookie: await loginCookie(h.url, user) });
    await asUser(h.url, admin, SET_STATUS, { input: { id: user.id, status: 'DISABLED' } });
    expect((await socket.closed).code).toBe(4401);
  });
});

describe('resync and leaks (RT-09, RT-05)', () => {
  it('sends system.resyncRequired after the Redis subscriber reconnects', async () => {
    const socket = await liveEvents(h.url, { cookie: cashier });
    await h.cutRedis();
    h.redisProxy.restore();
    await h.redisReady();
    const resync = eventOf(
      await socket.waitFor(
        isEvent('system.resyncRequired', (event) => event['reason'] === 'REDIS_RECONNECTED'),
        15_000,
      ),
    );
    expect(resync?.['__typename']).toBe('ResyncRequiredEvent');
    await socket.close();
  });

  it('returns sockets, streams and Redis subscriptions to baseline after 1,000 cycles', async () => {
    const hub = h.app.get(RealtimeHub);
    const connections = h.app.get(WsConnectionService);
    const pubsub = h.app.get(RedisPubSub);
    const counts = () => ({
      streams: hub.streamCount(),
      sockets: connections.socketCount,
      channels: pubsub.channelCount,
    });
    const idle = { streams: 0, sockets: 0, channels: 0 };
    await vi.waitFor(() => {
      expect(counts()).toEqual(idle); // earlier tests' sockets have finished closing
    });
    for (let cycle = 0; cycle < 1_000; cycle += 1) {
      const forwardedFor = `10.9.${String(Math.floor(cycle / 250))}.${String(cycle % 250)}`;
      const socket = openSocket(h.url, { cookie: cashier, forwardedFor });
      await socket.waitFor(isAck);
      socket.subscribe('events', SHOP_EVENTS);
      await socket.close();
    }
    // Server-side teardown of the last socket finishes shortly after the client sees the close.
    await vi.waitFor(() => {
      expect(counts()).toEqual(idle);
    });
  }, 120_000);
});
