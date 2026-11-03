import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UnitOfWork } from '../src/infrastructure/unit-of-work/unit-of-work';
import { SessionRevocationService } from '../src/modules/auth';

import { TEST_METRICS_TOKEN } from './support/app-factory';
import { createUser, loginCookie, whoAmI } from './support/auth';
import { startHarness, type Harness } from './support/harness';
import { openSocket, SHOP_EVENTS } from './support/ws-client';

let h: Harness;

const openSockets = async (): Promise<string | undefined> => {
  const response = await fetch(`${h.url}/metrics`, {
    headers: { authorization: `Bearer ${TEST_METRICS_TOKEN}` },
  });
  return /^pos_ws_connections (\d+)$/m.exec(await response.text())?.[1];
};

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

describe('signing everyone out after a leaked secret (DEPLOYMENT.md §10)', () => {
  it('revokes every session, including cached ones, and closes every socket with 4401', async () => {
    const admin = await loginCookie(
      h.url,
      await createUser(h, { username: 'reset.admin', role: 'ADMIN' }),
    );
    const cashier = await loginCookie(h.url, await createUser(h, { username: 'reset.till' }));
    expect(await whoAmI(h.url, admin)).toBe('reset.admin'); // now cached in Redis
    expect(await whoAmI(h.url, cashier)).toBe('reset.till');
    const socket = openSocket(h.url, { cookie: cashier, forwardedFor: '10.0.0.71' });
    await socket.waitFor((message) => message.type === 'connection_ack');
    socket.subscribe('1', SHOP_EVENTS);
    expect(await openSockets()).toBe('1'); // pos_ws_connections (DEPLOYMENT.md §8)

    const revoked = await h.app
      .get(UnitOfWork)
      .run(() => h.app.get(SessionRevocationService).revoke({ everyone: true }, 'SECURITY_RESET'));

    expect(revoked).toBeGreaterThanOrEqual(2);
    expect(await whoAmI(h.url, admin)).toBe('UNAUTHENTICATED');
    expect(await whoAmI(h.url, cashier)).toBe('UNAUTHENTICATED');
    expect((await socket.closed).code).toBe(4401);
    await expect.poll(openSockets).toBe('0');
  });
});
