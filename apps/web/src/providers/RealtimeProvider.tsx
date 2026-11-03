'use client';

import { useApolloClient } from '@apollo/client/react';
import { print } from 'graphql';
import { useEffect, useState } from 'react';

import { ShopEventsDocument } from '@/graphql/shop-events.subscription';
import { isHttpReachable } from '@/lib/apollo/network-status';
import { notifySessionEnded } from '@/lib/apollo/session-events';
import { createEventDedupe } from '@/lib/realtime/event-dedupe';
import { routeEvent, type EventContext } from '@/lib/realtime/event-router';
import { reconcile } from '@/lib/realtime/reconcile';
import { refetchActive } from '@/lib/realtime/refetch-active';
import { createWsClient, type LiveStatus } from '@/lib/realtime/ws-client';
import { createCoalescer } from '@/lib/timing/debounce';

import { RealtimeStatusContext } from './realtime-context';

import type { ShopEventsSubscription } from '@/graphql/__generated__/graphql';
import type { ReactNode } from 'react';

/** Aggregate refetches are coalesced to at most one per key per window (SYSTEM_DESIGN.md §5.4). */
const COALESCE_WINDOW_MS = 1_500;

/**
 * Opens the tab's single `shopEvents` subscription for signed-in screens and applies each event to
 * the Apollo cache; screens only read the cache (no component subscribes itself). Unmounting (sign
 * out, leaving the app area) disposes the socket.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    const coalescer = createCoalescer(COALESCE_WINDOW_MS);
    const isDuplicate = createEventDedupe();
    const context: EventContext = {
      cache: client.cache,
      refetchSoon: (names) => {
        coalescer.schedule(names.join(','), () => void refetchActive(client, names));
      },
      resync: () => void reconcile(client),
    };
    let disposed = false; // a disposed client's late close event must not change the status
    const ws = createWsClient({
      onStatus: (next) => {
        if (!disposed) setStatus(next);
      },
      onSessionEnded: notifySessionEnded,
      onReconnected: context.resync,
    });
    // Back online after a request failed at network level: recover now (refetch the active
    // queries once) instead of waiting for the socket's back-off (SYSTEM_DESIGN.md §5.8).
    const onOnline = (): void => {
      if (!isHttpReachable()) context.resync();
    };
    window.addEventListener('online', onOnline);
    const unsubscribe = ws.subscribe<ShopEventsSubscription>(
      { query: print(ShopEventsDocument) },
      {
        next: ({ data }) => {
          if (data != null && !isDuplicate(data.shopEvents.seq)) {
            routeEvent(data.shopEvents, context);
          }
        },
        error: () => undefined, // the client reconnects by itself; status shows the state
        complete: () => undefined,
      },
    );
    return () => {
      disposed = true;
      window.removeEventListener('online', onOnline);
      unsubscribe();
      coalescer.cancelAll();
      void ws.dispose();
    };
  }, [client]);

  return <RealtimeStatusContext.Provider value={status}>{children}</RealtimeStatusContext.Provider>;
}
