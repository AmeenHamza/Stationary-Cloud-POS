import { setTimeout as sleep } from 'node:timers/promises';

import { WORKLOAD } from '../config.js';
import { seededRandom } from '../random.js';

import { visitPlan } from './admin-session.js';
import { refundBill, sellBill, type CatalogSample, type SoldBill } from './counter-session.js';
import { openDay, type OpenDay } from './open-day.js';

import type { PerfApi } from '../measure/api-server.js';
import type { HttpMeter } from '../measure/http-client.js';
import type { LiveChannel } from '../measure/ws-bytes.js';

export interface DbWindow {
  bytes: number;
  statements: number;
}

export interface DayResult {
  bills: SoldBill[];
  refunds: number;
  restocks: number;
  db: { open: DbWindow; trading: DbWindow; idle: DbWindow & { seconds: number } };
  /** `countersAtOpen`: counter requests before the first bill (sign-in and terminal load). */
  http: { counters: HttpMeter; admin: HttpMeter; countersAtOpen: number };
  ws: {
    channels: number;
    received: number;
    events: number;
    largestEvent: number;
    idleBytes: number;
  };
}

/** Lets in-flight live events reach the admin tab before it decides what to refetch. */
const EVENT_SETTLE_MS = 150;

/** The bills, with a refund, restocks, admin visits and the admin's live refetches in between. */
async function trade(day: OpenDay, catalog: CatalogSample, progress: (message: string) => void) {
  const random = seededRandom(WORKLOAD.seed);
  const totalBills = WORKLOAD.counters * WORKLOAD.billsPerCounter;
  const spread = (count: number) =>
    Array.from({ length: count }, (_, k) => Math.floor(((k + 1) * totalBills) / (count + 1)));
  const visitAt = new Map(
    visitPlan().map((screen, v, all) => [Math.floor((v * totalBills) / all.length), screen]),
  );
  const restockAt = new Set(spread(WORKLOAD.restocks));
  const refundAt = new Set(spread(Math.round(totalBills * WORKLOAD.refundShare)));
  const bills: SoldBill[] = [];
  let refunds = 0;
  for (let index = 0; index < totalBills; index += 1) {
    const counter = day.counters[index % day.counters.length] ?? day.counters[0];
    if (counter === undefined) {
      throw new Error('no counter');
    }
    bills.push(await sellBill(counter.tab, catalog, random));
    if ((index + 1) % 10 === 0) {
      progress(`${String(index + 1)} bills`);
    }
    const earlier = bills[Math.max(0, index - 5)];
    if (refundAt.has(index) && earlier !== undefined) {
      await refundBill(counter.tab, earlier); // a customer brings back an earlier bill
      refunds += 1;
    }
    if (restockAt.has(index)) {
      await day.admin.restock();
    }
    await sleep(EVENT_SETTLE_MS);
    await day.admin.drain();
    const screen = visitAt.get(index);
    if (screen !== undefined) {
      await day.admin.visit(screen);
    }
  }
  await sleep(EVENT_SETTLE_MS);
  await day.admin.drain();
  return { bills, refunds, restocks: restockAt.size };
}

const sumOf = (channels: readonly LiveChannel[], field: 'received' | 'events'): number =>
  channels.reduce((total, channel) => total + channel[field], 0);

/** One trading day at the 1,500-bills-a-month pace on two counters, with an admin and idle time. */
export async function simulateDay(
  api: PerfApi,
  catalog: CatalogSample,
  origin: string,
  progress: (message: string) => void,
): Promise<DayResult> {
  api.db.take();
  progress('opening the counters and the admin');
  const day = await openDay(api, origin);
  const open = api.db.take();
  const countersAtOpen = day.meters.counters.requests;
  const traded = await trade(day, catalog, progress);
  const trading = api.db.take();
  progress(`idle for ${String(WORKLOAD.idleSampleSeconds)} s with every screen open`);
  const wsBefore = sumOf(day.channels, 'received');
  await sleep(WORKLOAD.idleSampleSeconds * 1_000); // every screen open, nothing happening
  const idle = { ...api.db.take(), seconds: WORKLOAD.idleSampleSeconds };
  const received = sumOf(day.channels, 'received');
  await Promise.all(day.channels.map((channel) => channel.close()));
  return {
    ...traded,
    db: { open, trading, idle },
    http: { ...day.meters, countersAtOpen },
    ws: {
      channels: day.channels.length,
      received,
      events: sumOf(day.channels, 'events'),
      largestEvent: Math.max(...day.channels.map((channel) => channel.largestEvent)),
      idleBytes: received - wsBefore,
    },
  };
}
