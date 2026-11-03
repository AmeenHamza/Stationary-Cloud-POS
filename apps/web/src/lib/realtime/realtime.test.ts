import { afterEach, describe, expect, it, vi } from 'vitest';

import { newIdempotencyKey } from '@/lib/ids/idempotency-key';
import { createCoalescer } from '@/lib/timing/debounce';

import { retryDelay, shouldRetry } from './backoff';
import { createEventDedupe } from './event-dedupe';
import { routeEvent, type EventContext } from './event-router';
import { LIVE_QUERIES } from './live-queries';

import type { ShopEvent } from './event-types';
import type { ApolloCache } from '@apollo/client';

afterEach(() => {
  vi.useRealTimers();
});

describe('reconnect backoff (RT-11)', () => {
  it('waits 500 ms to min(30 s, 1 s × 2^attempt), with full jitter', () => {
    expect(retryDelay(0, () => 0)).toBe(500);
    expect(retryDelay(0, () => 1)).toBe(1_000);
    expect(retryDelay(3, () => 1)).toBe(8_000);
    expect(retryDelay(20, () => 1)).toBe(30_000);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const delay = retryDelay(attempt);
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });

  it('never retries a closed session (4401) or a refused origin (4403)', () => {
    expect(shouldRetry({ code: 4401 })).toBe(false);
    expect(shouldRetry({ code: 4403 })).toBe(false);
    expect(shouldRetry({ code: 1006 })).toBe(true);
    expect(shouldRetry(new Error('network'))).toBe(true);
  });
});

describe('event de-duplication (RT-04 client side)', () => {
  it('applies each sequence number once and forgets the oldest past capacity', () => {
    const isDuplicate = createEventDedupe(2);
    expect(isDuplicate('1')).toBe(false);
    expect(isDuplicate('1')).toBe(true);
    expect(isDuplicate('2')).toBe(false);
    expect(isDuplicate('3')).toBe(false);
    expect(isDuplicate('1')).toBe(false); // evicted, so seen as new
  });
});

describe('coalesced refetch (RT-08)', () => {
  it('turns a burst of signals into one run per key per window', () => {
    vi.useFakeTimers();
    const coalescer = createCoalescer(1_500);
    const runs: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      coalescer.schedule('lowStock', () => runs.push(`low-${String(index)}`));
    }
    coalescer.schedule('settings', () => runs.push('settings'));
    vi.advanceTimersByTime(1_499);
    expect(runs).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(runs).toEqual(['low-9', 'settings']);
    coalescer.schedule('lowStock', () => runs.push('again'));
    coalescer.cancelAll();
    vi.advanceTimersByTime(5_000);
    expect(runs).toHaveLength(2);
  });
});

describe('event routing (SYSTEM_DESIGN.md §5.4)', () => {
  const context = () => {
    const refetched: (readonly string[])[] = [];
    let resyncs = 0;
    const ctx: EventContext = {
      cache: {} as ApolloCache, // aggregate signals never touch the cache
      refetchSoon: (names) => refetched.push(names),
      resync: () => {
        resyncs += 1;
      },
    };
    return { ctx, refetched, resyncs: () => resyncs };
  };
  const base = { seq: '1', type: 'x' };

  it('refetches mounted aggregates for signals and resyncs on request', () => {
    const { ctx, refetched, resyncs } = context();
    routeEvent({ ...base, __typename: 'LowStockCountChangedEvent', crossedProductIds: ['p'] }, ctx);
    routeEvent({ ...base, __typename: 'SettingsChangedEvent', version: 2 }, ctx);
    routeEvent({ ...base, __typename: 'ResyncRequiredEvent', reason: 'REDIS_RECONNECTED' }, ctx);
    // A type this client version does not know (a newer API) is ignored.
    routeEvent({ ...base, __typename: 'FutureEvent' } as unknown as ShopEvent, ctx);
    expect(refetched).toEqual([LIVE_QUERIES.lowStock, LIVE_QUERIES.settings]);
    expect(resyncs()).toBe(1);
  });
});

describe('idempotency keys (ADR-015)', () => {
  it('are UUIDv7 strings that sort by creation time', () => {
    const first = newIdempotencyKey(1_700_000_000_000);
    const later = newIdempotencyKey(1_700_000_000_001);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.slice(0, 13) < later.slice(0, 13)).toBe(true);
  });
});
