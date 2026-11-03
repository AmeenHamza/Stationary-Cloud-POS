import { PERF_USERS, type PerfUser } from '../config.js';
import { GraphqlSession, HttpMeter } from '../measure/http-client.js';
import { openLiveChannel, type LiveChannel } from '../measure/ws-bytes.js';

import { AdminTab } from './admin-session.js';
import { openTerminal } from './counter-session.js';
import * as op from './operations.js';

import type { PerfApi } from '../measure/api-server.js';

async function signIn(tab: GraphqlSession, user: PerfUser): Promise<void> {
  await tab.run(op.LoginDocument, { input: { username: user.username, password: user.password } });
}

export interface Counter {
  user: PerfUser;
  tab: GraphqlSession;
}

export interface OpenDay {
  counters: Counter[];
  admin: AdminTab;
  channels: LiveChannel[];
  meters: { counters: HttpMeter; admin: HttpMeter };
}

/** Sign-ins, live channels and the screens' first queries: two terminals and the admin overview. */
export async function openDay(api: PerfApi, origin: string): Promise<OpenDay> {
  const meters = { counters: new HttpMeter(), admin: new HttpMeter() };
  const counters = [PERF_USERS.counterA, PERF_USERS.counterB].map((user) => ({
    user,
    tab: new GraphqlSession(api.url, origin, meters.counters, api.db),
  }));
  const channels: LiveChannel[] = [];
  const live = (tab: GraphqlSession, onEvent?: (typename: string) => void) =>
    openLiveChannel(api.url, origin, tab.sessionCookie, op.ShopEventsDocument, onEvent);
  for (const counter of counters) {
    await signIn(counter.tab, counter.user);
    channels.push(await live(counter.tab));
    await openTerminal(counter.tab);
  }
  const adminSession = new GraphqlSession(api.url, origin, meters.admin, api.db);
  const admin = new AdminTab(adminSession);
  await signIn(adminSession, PERF_USERS.admin);
  channels.push(await live(adminSession, admin.onEvent));
  await admin.open();
  return { counters, admin, channels, meters };
}
