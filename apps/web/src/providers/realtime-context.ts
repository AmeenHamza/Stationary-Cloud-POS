'use client';

import { createContext, useContext } from 'react';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

import type { ConnectionStatus } from '@/components/layout/ConnectionBanner';
import type { LiveStatus } from '@/lib/realtime/ws-client';

export const RealtimeStatusContext = createContext<LiveStatus>('connecting');

/**
 * What the connection banner shows (SYSTEM_DESIGN.md §5.8): `offline` (no HTTP: billing paused)
 * takes precedence over the live channel's own state.
 */
export function useConnectionStatus(): ConnectionStatus {
  const live = useContext(RealtimeStatusContext);
  return useOnlineStatus() ? live : 'offline';
}
