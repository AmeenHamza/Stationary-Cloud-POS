import { signInOnce } from './auth.fixture.js';
import { API_URL } from './users.js';

import type { E2eUser } from './users.js';
import type { Browser, Page } from '@playwright/test';

/** API requests and WebSocket message types seen on a page since `reset()` (NET-04). */
export interface TrafficMeter {
  apiRequests: string[];
  socketMessages: string[];
  reset: () => void;
}

function messageType(payload: string | Buffer): string {
  try {
    const message = JSON.parse(String(payload)) as { type?: unknown };
    return typeof message.type === 'string' ? message.type : 'unknown';
  } catch {
    return 'not-json';
  }
}

/** Register before the first navigation: sockets opened during load are seen too. */
export function trafficMeter(page: Page): TrafficMeter {
  const meter: TrafficMeter = {
    apiRequests: [],
    socketMessages: [],
    reset: () => {
      meter.apiRequests.length = 0;
      meter.socketMessages.length = 0;
    },
  };
  page.on('request', (request) => {
    if (request.url().startsWith(API_URL)) {
      meter.apiRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on('websocket', (socket) => {
    socket.on('framesent', (frame) => meter.socketMessages.push(messageType(frame.payload)));
    socket.on('framereceived', (frame) => meter.socketMessages.push(messageType(frame.payload)));
  });
  return meter;
}

/** Bytes on the wire (compressed, headers included) for one page load, from the DevTools protocol. */
export interface LoadBytes {
  total: number;
  script: number;
  requests: number;
  /** Bytes per resource, `type path` (query strings dropped), largest first: for diagnosis. */
  resources: [string, number][];
}

const empty = (): LoadBytes => ({ total: 0, script: 0, requests: 0, resources: [] });

/**
 * Loads `path` in a fresh context (an empty HTTP cache) with the user's session, then again in the
 * same context (warm). `ready` resolves when the screen is usable (NET-05).
 */
export async function measureLoads(
  browser: Browser,
  user: E2eUser,
  path: string,
  ready: (page: Page) => Promise<void>,
): Promise<{ cold: LoadBytes; warm: LoadBytes }> {
  const primer = await browser.newContext(); // signs in once, so the measured load skips /login
  const home = user.role === 'ADMIN' ? '/dashboard' : '/terminal'; // where a sign-in lands
  await signInOnce(await primer.newPage(), user, home);
  await primer.close();
  const context = await browser.newContext();
  // The live socket is answered locally: its frames are not part of these byte counts, and twelve page
  // loads would otherwise spend the per-IP `ws-connect` budget the next spec needs (API.md §8).
  await context.routeWebSocket(/\/graphql$/, () => undefined);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const types = new Map<string, string>();
  const urls = new Map<string, string>();
  let bytes = empty();
  cdp.on('Network.responseReceived', (event) => {
    types.set(event.requestId, event.type);
    urls.set(event.requestId, new URL(event.response.url).pathname);
  });
  cdp.on('Network.loadingFinished', (event) => {
    bytes.total += event.encodedDataLength;
    bytes.requests += 1;
    const name = `${types.get(event.requestId) ?? '?'} ${urls.get(event.requestId) ?? '?'}`;
    bytes.resources.push([name, event.encodedDataLength]);
    if (types.get(event.requestId) === 'Script') {
      bytes.script += event.encodedDataLength;
    }
  });
  const settled = async (): Promise<LoadBytes> => {
    await ready(page);
    await page.waitForLoadState('networkidle');
    return { ...bytes, resources: [...bytes.resources].sort((a, b) => b[1] - a[1]) };
  };
  await signInOnce(page, user, path); // reuses the primer's session: the first load of `path`
  const cold = await settled();
  bytes = empty();
  await page.goto(path);
  const warm = await settled();
  await context.close();
  return { cold, warm };
}
